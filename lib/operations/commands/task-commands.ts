import {
getNextCollectionDate,
shiftDate
} from '../../business-calendar';
import {
isOverdue
} from '../../collection-status';
import { audit,put } from '../../database/operations-repository';
import { date,money,pick,text } from '../../validation/operation-values';
import type { OperationContext } from '../operation-context';
export function handleTaskCommand(type:string,context:OperationContext){const {command,database,s,today,now,getClient,getInstallment,resolve,activity}=context;if(type === 'defer_task'){
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
    }
else if([
        'complete_task',
        'record_contact',
        'payment_not_found',
        'management',
        'service',
        'external',
      ].includes(type)){
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
    }else return false;
return true;}