import type { OperationSnapshot } from './collection-types';
import { getEntries, getTasks } from './db';
import { processOperations } from './operations-store';
import { buildReport } from './rules';
import type { Action, Entry, Status, Task } from './types';
import { operationalActionLabel } from './operational-action-labels';
import { isReportableOperationalActivity } from './operational-activity-scope';
export function operationalActivityEntries(state: OperationSnapshot): Entry[] {
  const names = new Map(state.clients.map((client) => [client.id, client.name]));
  return state.activities
    .filter((a) => a.source !== 'legacy' && isReportableOperationalActivity(a))
    .map((a) => {
      const p = state.installments.find((p) => p.id === a.installmentId);
      let category: Entry['category'] = 'other',
        action: Action = 'other_action',
        status: Status = 'none';
      if (a.action === 'payment_confirmed') {
        category = 'payment';
        action = 'payment_checked';
        status = a.status === 'paid' ? 'payment_confirmed' : 'closed';
      } else if (a.action === 'payment_scheduled') {
        status = 'payment_scheduled';
      } else if (
        a.action === 'payment_status_checked' ||
        a.action === 'task_deferred' ||
        a.action === 'service_blocked' ||
        a.action === 'service_unblocked'
      ) {
        status = 'closed';
      } else if (a.action === 'external_collection') {
        status = 'external_collection';
      } else if (a.contact) {
        category = 'current';
        action = (
          {
            email: 'email_sent',
            whatsapp: 'whatsapp_sent',
            both: 'both_sent',
            phone: 'call',
            system: 'followup',
            other: 'other_action',
          } as Record<string, Action>
        )[a.channel];
        status = a.status === 'awaiting_reply' ? 'awaiting_reply' : 'monitoring';
      } else if (
        a.category === 'renegotiation' &&
        [
          'proposal_received',
          'awaiting_approval',
          'approved',
          'not_approved',
          'agreement_active',
        ].includes(a.status)
      ) {
        category = 'renegotiation';
        action = 'followup';
        status = a.status as Status;
      }
      return {
        id: a.id,
        clientId: a.clientId,
        installmentId: a.installmentId,
        source: 'operational' as const,
        operationalLabel: operationalActionLabel(a),
        name: names.get(a.clientId) || 'Cliente arquivado',
        category,
        action,
        status,
        date: a.date,
        days: null,
        lastContact: a.contact ? a.date : '',
        scheduled: '',
        notes: [
          p ? `${p.reference}, parcela ${p.number}.` : '',
          a.contact ? '' : operationalActionLabel(a) + '.',
          a.result,
          a.notes,
          `Responsável: ${a.responsible}.`,
        ]
          .filter(Boolean)
          .join(' '),
        createdAt: a.occurredAt,
        updatedAt: a.occurredAt,
      };
    });
}

export function buildStoredReport(date: string, extra = '', nextSteps = '') {
  const state = processOperations();
  return buildOperationalReport(date, state, getEntries(), getTasks(), extra, nextSteps);
}
export function buildOperationalReport(
  date: string,
  state: OperationSnapshot & { today: string },
  legacy: Entry[],
  tasks: Task[],
  extra = '',
  nextSteps = '',
) {
  const entries = legacy.map((r) => {
    const matches = r.clientId
      ? state.clients.filter((client) => client.id === r.clientId)
      : state.clients.filter((client) =>
          [client.name, ...(client.legacyNames || [])].some(
            (name) =>
              name.trim().toLocaleLowerCase('pt-BR') === r.name.trim().toLocaleLowerCase('pt-BR'),
          ),
        );
    if (matches.length !== 1) return { ...r, clientId: undefined };
    const installment = r.installmentId
      ? state.installments.find(
          (candidate) => candidate.id === r.installmentId && candidate.clientId === matches[0].id,
        )
      : undefined;
    return {
      ...r,
      clientId: matches[0].id,
      name: matches[0].name,
      notes: installment
        ? `${installment.reference}, parcela ${installment.number}. ${r.notes}`.trim()
        : r.notes,
    };
  });
  const operations = operationalActivityEntries(state).filter((record) => record.date === date);
  const result = buildReport(
    date,
    [...entries.filter((item) => item.date === date), ...operations],
    tasks.filter((task) => task.date === date),
    extra,
    nextSteps,
  );
  // The professional report describes work performed on the selected date.
  // Portfolio exposure and automatically generated pending tasks belong in
  // the Central, not in the daily activity report.
  return result;
}
