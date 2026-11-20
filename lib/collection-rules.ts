import {
  addBusinessDays,
  getNextCollectionDate,
  nextBusinessDay,
  previousOrSameBusinessDay,
  shiftDate,
} from './business-calendar';
import { daysOverdue, isOverdue, isUnpaid } from './collection-status';
import type { OperationSnapshot, PendingTask } from './collection-types';
import { isDate } from './rules';
import { isReportableOperationalActivity } from './operational-activity-scope';
import { outstandingCents } from './collection-status';
export const taskLabels: Record<string, string> = {
  advance: 'Enviar e-mail e WhatsApp com link de pagamento',
  due: 'Lembrar vencimento por WhatsApp',
  initial: 'Realizar cobrança inicial',
  window: 'Cobrar após janela de acompanhamento',
  fine: 'Verificar multa contratual',
  renegotiate: 'Avaliar renegociação com a gestão',
  alternate: 'Registrar nova tentativa de cobrança',
  scheduled_check: 'Conferir pagamento no sistema financeiro',
  scheduled_alert: 'Pagamento previsto ainda sem confirmação: conferir',
  block: 'Confirmar bloqueio do atendimento',
  unblock: 'Desbloquear atendimento',
  receipt: 'Anexar comprovante no sistema corporativo',
  crm: 'Atualizar CRM',
  management: 'Encaminhar caso para análise da gestão',
};
export function generateCollectionTasks(s: OperationSnapshot, today: string): PendingTask[] {
  if (!isDate(today)) throw Error('Data operacional inválida');
  const result: PendingTask[] = [],
    e = s.exceptions,
    cfg = s.settings;
  const add = (
    clientId: string,
    installmentId: string,
    kind: string,
    cycle: string,
    dueDate: string,
    reason: string,
    priority: PendingTask['priority'] = 'normal',
  ) => {
    const installment = s.installments.find((item) => item.id === installmentId);
    if (installment?.collectionStartDate && dueDate < installment.collectionStartDate) return;
    result.push({
      id: JSON.stringify([kind, clientId, installmentId, cycle]),
      clientId,
      installmentId,
      kind,
      rule: kind,
      cycle,
      dueDate,
      priority,
      status: 'open',
      reason,
      recommendation: taskLabels[kind],
      completedAt: '',
      deferReason: '',
      resolvedActivityId: '',
      createdAt: today,
    });
  };
  for (const client of s.clients) {
    const external = client.financialStatus === 'external';
    const installments = s.installments.filter(
      (p) =>
        p.clientId === client.id &&
        isDate(p.dueDate) &&
        Number.isSafeInteger(p.amountCents) &&
        p.amountCents > 0 &&
        Number.isSafeInteger(p.paidCents) &&
        p.paidCents >= 0,
    );
    const overdue = installments.filter((p) => isOverdue(p, today));
    const negotiations = s.negotiations
      .filter((n) => n.clientId === client.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const negotiation = negotiations[0];
    const isSuspended = (id: string) => {
      const n = negotiations.find((n) => n.installmentIds.includes(id));
      return (
        !!n &&
        ((['awaiting_approval', 'proposal_received', 'approved'].includes(n.status) &&
          (!n.suspensionUntil || today <= n.suspensionUntil)) ||
          n.status === 'agreement_active')
      );
    };
    const scheduledUnchecked = (id: string) => {
      const p = installments.find((p) => p.id === id)!;
      return (
        !!p.scheduledDate &&
        !s.activities.some(
          (a) =>
            a.installmentId === p.id &&
            a.action === 'payment_not_found' &&
            a.date >= p.scheduledDate,
        )
      );
    };
    const lastContact = s.activities
      .filter((a) => a.clientId === client.id && a.contact && a.date <= today)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    if (!external) {
      for (const p of installments) {
        if (!isUnpaid(p) || p.verificationStatus === 'unverified') continue;
        const cycle = p.id;
        const first = nextBusinessDay(p.dueDate, e);
        const scheduled = p.scheduledDate && isDate(p.scheduledDate);
        const notFound =
          scheduled &&
          s.activities.some(
            (a) =>
              a.installmentId === p.id &&
              a.action === 'payment_not_found' &&
              a.date >= p.scheduledDate,
          );
        if (scheduled && !notFound) {
          const check = nextBusinessDay(p.scheduledDate, e),
            alert = nextBusinessDay(check, e);
          add(
            client.id,
            p.id,
            'scheduled_check',
            p.scheduledDate,
            check,
            'Pagamento agendado não equivale a pagamento confirmado.',
          );
          if (today >= alert)
            add(
              client.id,
              p.id,
              'scheduled_alert',
              p.scheduledDate,
              alert,
              'O dia útil de conferência terminou sem confirmação. Verifique antes de cobrar.',
              'high',
            );
          continue;
        }
        if (isSuspended(p.id)) continue;
        add(
          client.id,
          p.id,
          'advance',
          cycle,
          previousOrSameBusinessDay(shiftDate(p.dueDate, -cfg.advanceDays), e),
          'D-' + cfg.advanceDays + ': enviar os dois canais somente após ação humana.',
        );
        add(
          client.id,
          p.id,
          'due',
          cycle,
          previousOrSameBusinessDay(p.dueDate, e),
          'Lembrete de vencimento; não representa inadimplência.',
        );
        if (today >= first) {
          add(
            client.id,
            p.id,
            'initial',
            cycle,
            first,
            'Primeiro dia útil após o vencimento. Início da janela de acompanhamento.',
            'high',
          );
          add(
            client.id,
            p.id,
            'window',
            cycle,
            nextBusinessDay(addBusinessDays(first, cfg.followupBusinessDays, e), e),
            'Cobrança no primeiro dia útil após o término de ' +
              cfg.followupBusinessDays +
              ' dias úteis.',
          );
          if (
            !client.serviceOverride &&
            (client.serviceStatus === 'active' || client.serviceStatus === 'block_pending')
          )
            add(
              client.id,
              p.id,
              'block',
              cycle,
              first,
              'Bloqueio deve ser executado e confirmado manualmente.',
              'high',
            );
          if (p.chargeStatus === 'verify')
            add(
              client.id,
              p.id,
              'fine',
              cycle,
              first,
              'Verificar se a multa contratual de ' +
                cfg.finePercent +
                '% é cabível. Nenhum valor foi aplicado.',
            );
        }
      }
      if (overdue.length >= 2) {
        const oldest = overdue.reduce((a, b) => (a.dueDate < b.dueDate ? a : b)),
          cycle = overdue
            .map((p) => p.id)
            .sort()
            .join('|');
        if (!negotiation || ['not_approved', 'cancelled'].includes(negotiation.status))
          add(
            client.id,
            oldest.id,
            'renegotiate',
            cycle,
            getNextCollectionDate(
              shiftDate(
                overdue
                  .map((p) => p.dueDate)
                  .sort()
                  .at(-1)!,
                1,
              ),
              e,
            ),
            `${overdue.length} parcelas vencidas; saldo vencido consolidado US$ ${(overdue.reduce((total, item) => total + outstandingCents(item), 0) / 100).toFixed(2)}; atraso mais antigo: ${daysOverdue(oldest, today)} dias. A proposta pode incluir só vencidas ou todo o saldo contratual restante. Novas condições exigem aprovação.`,
            'high',
          );
      }
      const collectible = overdue.filter((p) => !isSuspended(p.id) && !scheduledUnchecked(p.id));
      if (collectible.length) {
        const oldest = collectible.reduce((a, b) => (a.dueDate < b.dueDate ? a : b));
        const overdueBalance = overdue.reduce((sum, item) => sum + outstandingCents(item), 0);
        const debtContext = overdue.length >= 2
          ? `${overdue.length} parcelas vencidas; saldo vencido consolidado US$ ${(overdueBalance / 100).toFixed(2)}. `
          : '';
        const afterWindow = nextBusinessDay(
          addBusinessDays(nextBusinessDay(oldest.dueDate, e), cfg.followupBusinessDays, e),
          e,
        );
        // An imported, already-overdue installment starts follow-up on the day
        // the operator confirms its initial status, not on the historical due date.
        // Before the first actual contact, the first actionable collection can be today.
        const collectionStart = oldest.collectionStartDate;
        const freshPortfolio =
          !!collectionStart && oldest.dueDate < collectionStart;
        const recentContact = lastContact &&
          (!collectionStart || lastContact.date >= collectionStart)
          ? lastContact
          : undefined;
        if (freshPortfolio && today >= collectionStart) {
          const due = recentContact
            ? addBusinessDays(recentContact.date, cfg.alternateBusinessDays, e)
            : getNextCollectionDate(collectionStart, e);
          add(
            client.id,
            oldest.id,
            'alternate',
            recentContact?.id || oldest.id,
            due,
            recentContact
              ? debtContext + 'Continuar a cobrança a cada ' + cfg.alternateBusinessDays +
                ' dias úteis após o último contato efetivamente registrado.'
              : debtContext + 'Contrato antigo conferido: iniciar acompanhamento da dívida em aberto.',
            'high',
          );
        } else if (today >= afterWindow) {
          const base = lastContact && lastContact.date > afterWindow
            ? lastContact.date
            : afterWindow;
          add(
            client.id,
            oldest.id,
            'alternate',
            lastContact?.id || oldest.id,
            addBusinessDays(base, cfg.alternateBusinessDays, e),
            debtContext + 'Dias úteis alternados, com base no último contato efetivamente registrado.',
          );
        }
      }
      for (const n of negotiations.filter((n) =>
        ['proposal_received', 'awaiting_approval'].includes(n.status),
      ))
        add(
          client.id,
          '',
          'management',
          n.id,
          getNextCollectionDate(n.requestedDate, e),
          'Proposta depende de decisão registrada da gestão.',
        );

    }
    const payments = s.activities.filter(
      (a) =>
        a.clientId === client.id &&
        a.action === 'payment_confirmed' &&
        isReportableOperationalActivity(a),
    );
    for (const payment of payments) {
      const installment = installments.find((p) => p.id === payment.installmentId);
      if (!installment) continue;
      add(
        client.id,
        installment.id,
        'receipt',
        payment.id,
        getNextCollectionDate(payment.date, e),
        'Anexar comprovante manualmente no sistema corporativo.',
      );
      add(
        client.id,
        installment.id,
        'crm',
        payment.id,
        getNextCollectionDate(payment.date, e),
        'Atualizar CRM após a conciliação registrada.',
      );
    }
    if (
      !overdue.length &&
      payments.length &&
      (client.serviceStatus === 'blocked' || client.serviceStatus === 'unblock_pending')
    )
      add(
        client.id,
        '',
        'unblock',
        payments.at(-1)!.id,
        getNextCollectionDate(payments.at(-1)!.date, e),
        'Sem outras parcelas vencidas. Verificar condições e registrar desbloqueio manual.',
        'high',
      );
  }
  return result;
}
