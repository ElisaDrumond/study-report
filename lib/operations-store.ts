import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { db as defaultDb } from './db';
import { isDate, validateEntry, actions } from './rules';
import type { Entry } from './types';
import {
  operationToday,
  shiftDate,
  getNextCollectionDate,
  type CalendarException,
} from './business-calendar';
import { generateCollectionTasks } from './collection-rules';
import { reconcileTasks } from './task-generator';
import {
  isOverdue,
  isUnpaid,
  outstandingCents,
  negotiationLabels,
  formatCurrency,
} from './collection-status';
import {
  defaultSettings,
  type Client,
  type Installment,
  type Negotiation,
  type OperationActivity,
  type PendingTask,
  type OperationSnapshot,
  type CollectionSettings,
} from './collection-types';

type Row = { id: string; data: string };
const tables = [
  'op_clients',
  'op_installments',
  'op_activities',
  'op_pending',
  'op_negotiations',
  'op_calendar',
  'op_audit',
  'op_settings',
  'op_commands',
] as const;
function read<T>(db: Database.Database, table: (typeof tables)[number]): T[] {
  return (db.prepare(`SELECT data FROM ${table} ORDER BY rowid`).all() as Row[]).map((r) =>
    JSON.parse(r.data),
  );
}
function put<T extends { id: string }>(
  db: Database.Database,
  table: (typeof tables)[number],
  value: T,
  insert = false,
) {
  db.prepare(
    `INSERT INTO ${table}(id,data) VALUES(?,?) ${insert ? '' : 'ON CONFLICT(id) DO UPDATE SET data=excluded.data'}`,
  ).run(value.id, JSON.stringify(value));
}
const text = (value: unknown, label: string, required = false) => {
  if (typeof value !== 'string' || value.length > 10000 || (required && !value.trim()))
    throw Error(label + ' inválido');
  return value.trim();
};
const date = (value: unknown, label = 'Data') => {
  if (typeof value !== 'string' || !isDate(value)) throw Error(label + ' inválida');
  return value;
};
const money = (value: unknown, label = 'Valor') => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 100000000000
  )
    throw Error(label + ' inválido (use centavos inteiros)');
  return value;
};
function pick<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw Error(label + ' inválido');
  return value as T;
}
export function snapshot(database = defaultDb()): OperationSnapshot {
  const settings =
    read<CollectionSettings & { id: string }>(database, 'op_settings')[0] ?? defaultSettings;
  const clients = read<Client>(database, 'op_clients'),
    activities = read<OperationActivity>(database, 'op_activities');
  const columns = new Set(
    (database.prepare('PRAGMA table_info(entries)').all() as { name: string }[]).map((c) => c.name),
  );
  if (columns.has('action'))
    for (const r of database.prepare('SELECT * FROM entries').all() as Entry[]) {
      if (validateEntry(r).length || r.action === 'none') continue;
      const matches = clients.filter((c) =>
        [c.name, ...(c.legacyNames || [])].some(
          (name) =>
            name.trim().toLocaleLowerCase('pt-BR') === r.name.trim().toLocaleLowerCase('pt-BR'),
        ),
      );
      if (matches.length !== 1) continue;
      const channel = (
        {
          email_sent: 'email',
          email_replied: 'email',
          whatsapp_sent: 'whatsapp',
          message_replied: 'whatsapp',
          both_sent: 'both',
          call: 'phone',
        } as Partial<Record<Entry['action'], OperationActivity['channel']>>
      )[r.action];
      activities.push({
        id: 'legacy:' + r.id,
        source: 'legacy',
        clientId: matches[0].id,
        installmentId: '',
        category: r.category,
        action: r.action,
        status: r.status,
        occurredAt: r.date + 'T00:00:00',
        date: r.date,
        channel: channel || 'system',
        notes: r.notes,
        result: actions[r.action],
        responsible: 'Registro legado',
        contact: !!channel,
        taskId: '',
        amountCents: 0,
      });
    }
  activities.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return {
    clients,
    installments: read(database, 'op_installments'),
    activities,
    pending: read(database, 'op_pending'),
    negotiations: read(database, 'op_negotiations'),
    exceptions: read(database, 'op_calendar'),
    audit: read(database, 'op_audit'),
    settings,
  };
}
function audit(
  database: Database.Database,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
  reason: string,
) {
  put(
    database,
    'op_audit',
    {
      id: crypto.randomUUID(),
      entity,
      entityId,
      before,
      after,
      reason,
      at: new Date().toISOString(),
    } as { id: string },
    true,
  );
}
export function processOperations(database = defaultDb(), referenceDate?: string) {
  return database.transaction(() => {
    let state = snapshot(database);
    const today = referenceDate ?? operationToday(state.settings.timezone);
    const next = reconcileTasks(state.pending, generateCollectionTasks(state, today)).map((t) =>
      t.status === 'deferred'
        ? {
            ...t,
            dueDate: getNextCollectionDate(t.deferRequestedDate || t.dueDate, state.exceptions),
          }
        : t,
    );
    for (const task of next) {
      const old = state.pending.find((p) => p.id === task.id);
      if (JSON.stringify(old) !== JSON.stringify(task)) {
        put(database, 'op_pending', task);
        if (old)
          audit(
            database,
            'pending',
            task.id,
            old,
            task,
            'Reprocessamento das regras ou calendário',
          );
      }
    }
    for (const client of state.clients) {
      if (
        client.financialStatus === 'external' &&
        state.installments.some((p) => p.clientId === client.id && isUnpaid(p))
      )
        continue;
      const overdue = state.installments.some(
        (p) => p.clientId === client.id && isOverdue(p, today),
      );
      const blocked = next.some(
        (p) =>
          p.clientId === client.id && p.kind === 'block' && ['open', 'deferred'].includes(p.status),
      );
      const unblock = next.some(
        (p) =>
          p.clientId === client.id &&
          p.kind === 'unblock' &&
          ['open', 'deferred'].includes(p.status),
      );
      const serviceStatus =
        client.serviceStatus === 'active' && blocked
          ? 'block_pending'
          : client.serviceStatus === 'block_pending' && !blocked
            ? 'active'
            : client.serviceStatus === 'blocked' && unblock
              ? 'unblock_pending'
              : client.serviceStatus === 'unblock_pending' && !unblock
                ? 'blocked'
                : client.serviceStatus;
      const updated: Client = {
        ...client,
        financialStatus: overdue ? 'overdue' : 'current',
        serviceStatus,
        serviceOverride: overdue ? client.serviceOverride : false,
      };
      if (JSON.stringify(updated) !== JSON.stringify(client)) {
        put(database, 'op_clients', updated);
        audit(
          database,
          'client',
          client.id,
          client,
          updated,
          'Situação calculada; nenhuma ação de bloqueio executada',
        );
      }
    }
    state = snapshot(database);
    return { ...state, today };
  })();
}

export function mutateOperation(
  command: Record<string, unknown>,
  database = defaultDb(),
  referenceDate?: string,
) {
  return database.transaction(() => {
    const s = snapshot(database),
      today = referenceDate ?? operationToday(s.settings.timezone),
      now = new Date().toISOString();
    const operationId = command.operationId
      ? text(command.operationId, 'Identificador da operação', true)
      : '';
    const commandHash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
    if (operationId) {
      const row = database.prepare('SELECT data FROM op_commands WHERE id=?').get(operationId) as
        Row | undefined;
      if (row) {
        if (JSON.parse(row.data).commandHash !== commandHash)
          throw Error('Identificador já utilizado para outra operação');
        return processOperations(database, today);
      }
    }
    const type = text(command.type, 'Operação', true);
    const getClient = (id: unknown) => {
      const c = s.clients.find((c) => c.id === id);
      if (!c) throw Error('Cliente não encontrado');
      return c;
    };
    const getInstallment = (id: unknown) => {
      const p = s.installments.find((p) => p.id === id);
      if (!p) throw Error('Parcela não encontrada');
      return p;
    };
    const resolve = (task: PendingTask, activity: OperationActivity) => {
      put(database, 'op_pending', {
        ...task,
        status: 'done',
        completedAt: now,
        resolvedActivityId: activity.id,
      });
      audit(
        database,
        'pending',
        task.id,
        task,
        { status: 'done', activityId: activity.id },
        'Conclusão confirmada manualmente',
      );
    };
    const activity = (data: Partial<OperationActivity> & { clientId: string; action: string }) => {
      getClient(data.clientId);
      const a: OperationActivity = {
        id: crypto.randomUUID(),
        installmentId: '',
        category: 'operational',
        status: 'recorded',
        occurredAt: now,
        date: today,
        channel: 'system',
        notes: text(command.notes ?? '', 'Observações'),
        result: text(command.result ?? 'Registrado manualmente', 'Resultado', true),
        responsible: text(command.responsible, 'Responsável', true),
        contact: false,
        taskId: '',
        amountCents: 0,
        ...data,
      };
      put(database, 'op_activities', a, true);
      return a;
    };
    if (type === 'import_legacy_clients') {
      const rows = database.prepare('SELECT name FROM entries ORDER BY rowid').all() as {
        name: string;
      }[];
      const names = new Set(s.clients.map((c) => c.name.trim().toLocaleLowerCase('pt-BR')));
      for (const row of rows) {
        const name = row.name.trim(),
          key = name.toLocaleLowerCase('pt-BR');
        if (!name || names.has(key)) continue;
        names.add(key);
        const c: Client = {
          id: crypto.randomUUID(),
          name,
          crmRef: '',
          financialStatus: 'current',
          serviceStatus: 'active',
          notes: 'Nome importado do histórico. Cadastre parcelas para habilitar as regras.',
          createdAt: now,
        };
        put(database, 'op_clients', c);
        audit(
          database,
          'client',
          c.id,
          null,
          c,
          'Importação de nome do histórico; valores e contratos não inferidos',
        );
      }
    } else if (type === 'save_client') {
      const old = s.clients.find((c) => c.id === command.id);
      const c: Client = {
        id: old?.id || crypto.randomUUID(),
        name: text(command.name, 'Nome', true),
        crmRef: text(command.crmRef ?? '', 'Referência CRM'),
        notes: text(command.notes ?? '', 'Observações'),
        financialStatus: old?.financialStatus || 'current',
        serviceStatus: old?.serviceStatus || 'active',
        createdAt: old?.createdAt || now,
        legacyNames: old ? [...new Set([old.name, ...(old.legacyNames || [])])] : [],
        serviceOverride: old?.serviceOverride || false,
      };
      put(database, 'op_clients', c);
      audit(database, 'client', c.id, old ?? null, c, 'Cadastro/edição manual');
    } else if (type === 'save_installment') {
      const c = getClient(command.clientId),
        old = s.installments.find((p) => p.id === command.id);
      if (old && old.clientId !== c.id)
        throw Error('Não é permitido transferir uma parcela entre clientes');
      const number = money(command.number, 'Número da parcela');
      if (number < 1) throw Error('Número da parcela obrigatório');
      const p: Installment = {
        id: old?.id || crypto.randomUUID(),
        clientId: c.id,
        reference: text(command.reference, 'Referência/contrato', true),
        number,
        amountCents: money(command.amountCents),
        dueDate: date(command.dueDate),
        paidDate: old?.paidDate || '',
        paidCents: old?.paidCents || 0,
        status: old?.status || 'open',
        chargesCents: money(command.chargesCents ?? 0, 'Encargos'),
        chargeStatus: pick(
          command.chargeStatus ?? 'verify',
          ['verify', 'applied', 'not_applicable'] as const,
          'Situação do encargo',
        ),
        scheduledDate: old?.scheduledDate || '',
        createdAt: old?.createdAt || now,
      };
      if (p.amountCents <= 0) throw Error('Valor original deve ser positivo');
      if (
        s.installments.some(
          (x) =>
            x.id !== p.id &&
            x.clientId === p.clientId &&
            x.reference === p.reference &&
            x.number === p.number,
        )
      )
        throw Error('Já existe essa parcela para o contrato');
      if (
        old?.status === 'paid' ||
        p.paidCents >= p.amountCents + (p.chargeStatus === 'applied' ? p.chargesCents : 0)
      )
        throw Error('Parcela quitada exige revisão específica; valores não foram alterados');
      const reason = old
        ? text(command.reason, 'Justificativa da alteração', true)
        : 'Cadastro manual';
      put(database, 'op_installments', p);
      audit(database, 'installment', p.id, old ?? null, p, reason);
    } else if (type === 'schedule_payment') {
      const old = getInstallment(command.installmentId);
      if (!isUnpaid(old)) throw Error('Parcela já quitada ou cancelada');
      const scheduledDate = date(command.scheduledDate);
      if (scheduledDate < today) throw Error('Agendamento deve ser hoje ou futuro');
      const p = { ...old, scheduledDate };
      put(database, 'op_installments', p);
      audit(database, 'installment', p.id, old, p, 'Pagamento previsto, sem confirmação');
      activity({
        clientId: p.clientId,
        installmentId: p.id,
        action: 'payment_scheduled',
        result: 'Pagamento previsto para ' + scheduledDate + '; ainda não confirmado.',
      });
    } else if (type === 'confirm_payment') {
      if (command.confirmed !== true) throw Error('Confirmação humana obrigatória');
      const old = getInstallment(command.installmentId),
        amountCents = money(command.amountCents, 'Valor recebido'),
        paidDate = date(command.paidDate);
      if (
        !isUnpaid(old) ||
        amountCents <= 0 ||
        amountCents > outstandingCents(old) ||
        paidDate > today
      )
        throw Error('Pagamento inválido para o saldo ou data da parcela');
      const paidCents = old.paidCents + amountCents,
        settled =
          paidCents >= old.amountCents + (old.chargeStatus === 'applied' ? old.chargesCents : 0);
      const p = {
        ...old,
        paidCents,
        paidDate,
        status: settled ? ('paid' as const) : ('partial' as const),
      };
      put(database, 'op_installments', p);
      audit(database, 'installment', p.id, old, p, 'Pagamento confirmado manualmente');
      const a = activity({
        clientId: p.clientId,
        installmentId: p.id,
        action: 'payment_confirmed',
        category: 'conciliation',
        status: settled ? 'paid' : 'partial',
        amountCents,
        result: `Conciliação registrada: ${formatCurrency(amountCents)}. ${settled ? 'Parcela quitada.' : 'Pagamento parcial; saldo permanece aberto.'} Data do pagamento: ${paidDate}.`,
      });
      if (settled)
        for (const task of s.pending.filter(
          (t) => t.installmentId === p.id && ['open', 'deferred'].includes(t.status),
        ))
          resolve(task, a);
    } else if (type === 'save_negotiation') {
      const c = getClient(command.clientId),
        old = s.negotiations.find((n) => n.id === command.id);
      if (old && old.clientId !== c.id) throw Error('Cliente da renegociação não pode mudar');
      const installmentIds = command.installmentIds;
      if (
        !Array.isArray(installmentIds) ||
        !installmentIds.length ||
        installmentIds.some((id) => getInstallment(id).clientId !== c.id)
      )
        throw Error('Selecione parcelas válidas do cliente');
      const status = pick(
        command.status,
        [
          'proposal_received',
          'awaiting_approval',
          'approved',
          'not_approved',
          'agreement_active',
          'cancelled',
        ] as const,
        'Status',
      );
      const approvedDate = ['approved', 'agreement_active'].includes(status)
        ? command.approvedDate
          ? date(command.approvedDate)
          : old?.approvedDate || ''
        : '';
      if (
        ['approved', 'agreement_active'].includes(status) &&
        (!approvedDate ||
          command.confirmed !== true ||
          approvedDate > today ||
          !text(command.authorizedTerms, 'Condições autorizadas', true))
      )
        throw Error('Aprovação registrada, condições e confirmação humana são obrigatórias');
      if (
        status === 'agreement_active' &&
        (!old?.approvedDate || !['approved', 'agreement_active'].includes(old.status))
      )
        throw Error('Registre a aprovação antes de formalizar o acordo');
      const suspensionUntil = command.suspensionUntil ? date(command.suspensionUntil) : '';
      if (suspensionUntil && command.confirmed !== true)
        throw Error('Suspensão exige autorização manual');
      const n: Negotiation = {
        id: old?.id || crypto.randomUUID(),
        clientId: c.id,
        installmentIds: [...new Set(installmentIds)] as string[],
        requestedDate: date(command.requestedDate),
        proposal: text(command.proposal, 'Proposta', true),
        status,
        approvedDate,
        authorizedTerms: text(command.authorizedTerms ?? '', 'Condições'),
        suspensionUntil,
        createdAt: old?.createdAt || now,
      };
      if (n.requestedDate > today) throw Error('Solicitação não pode estar no futuro');
      if (n.approvedDate && n.approvedDate < n.requestedDate)
        throw Error('Aprovação não pode anteceder a solicitação');
      put(database, 'op_negotiations', n);
      const a = activity({
        clientId: c.id,
        action: 'negotiation_' + status,
        category: 'renegotiation',
        status,
        result: 'Status da proposta: ' + negotiationLabels[status] + '. ' + n.proposal,
      });
      audit(
        database,
        'negotiation',
        n.id,
        old ?? null,
        n,
        'Decisão registrada por ' + a.responsible,
      );
    } else if (type === 'save_calendar' || type === 'delete_calendar') {
      if (type === 'delete_calendar') {
        const old = s.exceptions.find((e) => e.id === command.id);
        if (!old) throw Error('Exceção não encontrada');
        database.prepare('DELETE FROM op_calendar WHERE id=?').run(old.id);
        audit(database, 'calendar', old.id, old, null, 'Exclusão manual');
      } else {
        const start = date(command.date),
          end = command.endDate ? date(command.endDate) : start;
        if (end < start || end > shiftDate(start, 366))
          throw Error('Período inválido; máximo de 367 dias');
        const exceptionType = pick(
            command.exceptionType,
            ['non_business', 'business'] as const,
            'Exceção',
          ),
          description = text(command.description, 'Descrição', true);
        const editing = command.id ? s.exceptions.find((e) => e.id === command.id) : undefined;
        if (command.id && !editing) throw Error('Exceção não encontrada');
        if (editing && start !== end) throw Error('Edite apenas uma data por vez');
        if (editing && editing.date !== start) {
          database.prepare('DELETE FROM op_calendar WHERE id=?').run(editing.id);
          audit(database, 'calendar', editing.id, editing, null, 'Mudança da data da exceção');
        }
        for (let d = start; d <= end; d = shiftDate(d, 1)) {
          const old = s.exceptions.find((e) => e.date === d);
          const exception: CalendarException = {
            id: old?.id || editing?.id || crypto.randomUUID(),
            date: d,
            type: exceptionType,
            description,
            createdAt: old?.createdAt || editing?.createdAt || now,
          };
          put(database, 'op_calendar', exception);
          audit(database, 'calendar', exception.id, old ?? null, exception, 'Exceção manual');
        }
      }
    } else if (type === 'save_settings') {
      const timezone = text(command.timezone, 'Fuso horário', true);
      try {
        operationToday(timezone);
      } catch {
        throw Error('Fuso horário inválido');
      }
      const settings = { ...s.settings, timezone };
      for (const key of [
        'advanceDays',
        'followupBusinessDays',
        'alternateBusinessDays',
        'externalReviewDays',
        'finePercent',
      ] as const) {
        const v = money(command[key], key);
        if (v < 1 || v > 365) throw Error('Parâmetros devem estar entre 1 e 365');
        settings[key] = v;
      }
      put(database, 'op_settings', { ...settings, id: 'default' });
      audit(database, 'settings', 'default', s.settings, settings, 'Configuração manual');
    } else if (type === 'defer_task') {
      const old = s.pending.find(
        (t) => t.id === command.taskId && ['open', 'deferred'].includes(t.status),
      );
      if (!old) throw Error('Pendência não disponível');
      const due = getNextCollectionDate(date(command.dueDate), s.exceptions);
      if (due <= today) throw Error('Adiamento deve ser futuro');
      const task = {
        ...old,
        status: 'deferred' as const,
        dueDate: due,
        deferRequestedDate: date(command.dueDate),
        deferReason: text(command.reason, 'Justificativa', true),
      };
      put(database, 'op_pending', task);
      audit(database, 'pending', task.id, old, task, task.deferReason);
    } else if (
      [
        'complete_task',
        'record_contact',
        'payment_not_found',
        'management',
        'service',
        'external',
      ].includes(type)
    ) {
      const task = command.taskId
        ? s.pending.find((t) => t.id === command.taskId && ['open', 'deferred'].includes(t.status))
        : undefined;
      if (command.taskId && !task) throw Error('Pendência não disponível');
      const p = task?.installmentId
        ? getInstallment(task.installmentId)
        : command.installmentId
          ? getInstallment(command.installmentId)
          : undefined;
      const c = getClient(task?.clientId || command.clientId || p?.clientId);
      if (p && p.clientId !== c.id) throw Error('Parcela incompatível com o cliente');
      if (type === 'external') {
        if (command.confirmed !== true) throw Error('Encaminhamento externo exige confirmação');
        text(command.notes, 'Justificativa', true);
        const a = activity({
          clientId: c.id,
          action: 'external_collection',
          result: 'Encaminhamento externo confirmado manualmente.',
        });
        const next = { ...c, financialStatus: 'external' as const };
        put(database, 'op_clients', next);
        audit(database, 'client', c.id, c, next, 'Encaminhamento por ' + a.responsible);
      } else if (type === 'service') {
        if (command.confirmed !== true) throw Error('Alteração do atendimento exige confirmação');
        const status = pick(command.serviceStatus, ['blocked', 'active'] as const, 'Atendimento');
        if (
          status === 'active' &&
          s.installments.some((p) => p.clientId === c.id && isOverdue(p, today)) &&
          (!command.authorizedOverride || !text(command.notes, 'Decisão autorizada', true))
        )
          throw Error('Há parcelas vencidas; registre decisão autorizada para desbloquear');
        const a = activity({
          clientId: c.id,
          action: status === 'blocked' ? 'service_blocked' : 'service_unblocked',
          result:
            'Atendimento ' +
            (status === 'blocked' ? 'bloqueado' : 'ativo') +
            ' após confirmação manual.',
        });
        const next = {
          ...c,
          serviceStatus: status,
          serviceOverride: status === 'active' && command.authorizedOverride === true,
        };
        put(database, 'op_clients', next);
        audit(database, 'client', c.id, c, next, 'Alteração por ' + a.responsible);
        for (const t of s.pending.filter(
          (t) =>
            t.clientId === c.id &&
            t.kind === (status === 'blocked' ? 'block' : 'unblock') &&
            ['open', 'deferred'].includes(t.status),
        ))
          resolve(t, a);
      } else if (type === 'payment_not_found') {
        if (
          !p ||
          !p.scheduledDate ||
          today < getNextCollectionDate(shiftDate(p.scheduledDate, 1), s.exceptions)
        )
          throw Error('Aguarde o dia útil de conferência do pagamento');
        const a = activity({
          clientId: c.id,
          installmentId: p.id,
          action: 'payment_not_found',
          result: 'Pagamento não identificado no sistema financeiro.',
        });
        for (const t of s.pending.filter(
          (t) =>
            t.installmentId === p.id &&
            ['scheduled_check', 'scheduled_alert'].includes(t.kind) &&
            ['open', 'deferred'].includes(t.status),
        ))
          resolve(t, a);
      } else if (type === 'management') {
        activity({
          clientId: c.id,
          installmentId: p?.id || '',
          action: 'management_requested',
          result: text(command.result, 'Encaminhamento para análise', true),
        });
      } else {
        if (type === 'complete_task' && !task) throw Error('Selecione uma tarefa');
        if (
          type === 'complete_task' &&
          task &&
          ['block', 'unblock', 'scheduled_check', 'scheduled_alert'].includes(task.kind)
        )
          throw Error('Use a ação específica de atendimento ou conferência');
        const contactKinds = ['advance', 'due', 'initial', 'window', 'alternate'];
        const contact = type === 'record_contact' || !!(task && contactKinds.includes(task.kind));
        const channel = pick(
          command.channel ?? 'system',
          ['email', 'whatsapp', 'both', 'phone', 'system', 'other'] as const,
          'Canal',
        );
        if (contact && !['email', 'whatsapp', 'both', 'phone'].includes(channel))
          throw Error('Registre o canal do contato efetivo');
        if (task?.kind === 'advance' && channel !== 'both')
          throw Error('Esta tarefa exige confirmação de e-mail e WhatsApp');
        if (task?.kind === 'due' && channel !== 'whatsapp')
          throw Error('O lembrete de vencimento utiliza WhatsApp');
        if (type === 'complete_task' && task?.kind === 'fine' && p) {
          const chargeStatus = pick(
            command.chargeStatus,
            ['verify', 'applied', 'not_applicable'] as const,
            'Encargo',
          );
          if (chargeStatus === 'verify') throw Error('Informe o resultado da verificação');
          const next = {
            ...p,
            chargeStatus,
            chargesCents: money(command.chargesCents ?? 0, 'Encargos'),
          };
          put(database, 'op_installments', next);
          audit(database, 'installment', p.id, p, next, 'Encargo verificado manualmente');
        }
        if (
          contact &&
          p?.scheduledDate &&
          !s.activities.some(
            (a) =>
              a.installmentId === p.id &&
              a.action === 'payment_not_found' &&
              a.date >= p.scheduledDate,
          )
        )
          throw Error(
            'Confira primeiro o pagamento agendado e registre o resultado antes de novo contato de cobrança',
          );
        const a = activity({
          clientId: c.id,
          installmentId: p?.id || '',
          taskId: task?.id || '',
          action: contact ? 'contact' : task?.kind || 'manual',
          contact,
          channel,
          result: text(command.result, 'Resultado', true),
          status: command.awaitingReply ? 'awaiting_reply' : 'recorded',
        });
        if (task && (type === 'complete_task' || contactKinds.includes(task.kind)))
          resolve(task, a);
      }
    } else throw Error('Operação desconhecida');
    if (operationId)
      put(database, 'op_commands', { id: operationId, commandHash, completedAt: now }, true);
    return processOperations(
      database,
      type === 'save_settings' && !referenceDate ? undefined : today,
    );
  })();
}
