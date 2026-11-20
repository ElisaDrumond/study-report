import { daysOverdue, isOverdue, outstandingCents } from './collection-status';
import type { OperationSnapshot } from './collection-types';
import { getEntries, getTasks } from './db';
import { processOperations } from './operations-store';
import { buildReport, fmt } from './rules';
import type { Action, Entry, Status, Task } from './types';
const money = (c: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
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
  const names = new Map(state.clients.map((c) => [c.id, c.name]));
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
  const operations: Entry[] = state.activities
    .filter((a) => a.date === date && a.source !== 'legacy')
    .map((a) => {
      const p = state.installments.find((p) => p.id === a.installmentId);
      let category: Entry['category'] = 'other',
        action: Action = 'other_action',
        status: Status = 'none';
      if (a.action === 'payment_confirmed') {
        category = a.status === 'paid' ? 'payment' : 'conciliation';
        action = a.status === 'paid' ? 'payment_checked' : 'conciliation_done';
        status = a.status === 'paid' ? 'payment_confirmed' : 'monitoring';
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
  const result = buildReport(date, [...entries, ...operations], tasks, extra, nextSteps);
  const sections: string[] = [];
  let number = [...result.body.matchAll(/^\d+\. /gm)].length;
  const overdue = state.installments.filter((p) => isOverdue(p, state.today));
  if (overdue.length)
    sections.push(
      `${++number}. Carteira operacional em acompanhamento (posição atual)\n\n` +
        overdue
          .map(
            (p) =>
              `- ${names.get(p.clientId)} — ${p.reference}, parcela ${p.number}; vencimento ${fmt(p.dueDate)}; ${daysOverdue(p, state.today)} dias corridos em atraso; saldo registrado ${money(outstandingCents(p))}${p.scheduledDate ? `; pagamento previsto ${fmt(p.scheduledDate)} (não confirmado)` : ''}.`,
          )
          .join('\n'),
    );
  const pending = state.pending.filter((t) => t.status === 'open' || t.status === 'deferred');
  if (pending.length)
    sections.push(
      `${++number}. Pendências operacionais sugeridas (não contabilizadas como realizadas)\n\n` +
        pending
          .map(
            (t) =>
              `- ${names.get(t.clientId)} — ${t.recommendation}; prazo ${fmt(t.dueDate)}; ${t.status === 'deferred' ? 'adiada' : 'aberta'}${t.deferReason ? `; justificativa: ${t.deferReason}` : ''}.`,
          )
          .join('\n'),
    );
  if (sections.length)
    result.body = result.body.replace(
      'Permaneço à disposição para eventuais orientações.',
      sections.join('\n\n') + '\n\nPermaneço à disposição para eventuais orientações.',
    );
  return result;
}
