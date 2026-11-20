import { negotiationLabels } from '../../collection-status';
import { type Negotiation } from '../../collection-types';
import { audit, put } from '../../database/operations-repository';
import { date, pick, text } from '../../validation/operation-values';
import type { OperationContext } from '../operation-context';
export function handleNegotiationCommand(type: string, context: OperationContext) {
  const { command, state, today, now, getClient, getInstallment, activity, database } = context;
  if (type === 'save_negotiation') {
    const c = getClient(command.clientId),
      old = state.negotiations.find((n) => n.id === command.id);
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
    audit(database, 'negotiation', n.id, old ?? null, n, 'Decisão registrada por ' + a.responsible);
  } else return false;
  return true;
}
