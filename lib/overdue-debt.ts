import { isOverdue, outstandingCents } from './collection-status';
import type { Installment, OperationSnapshot } from './collection-types';

export function overdueDebt(
  installments: Installment[],
  clientId: string,
  today: string,
) {
  const overdue = installments.filter((p) => p.clientId === clientId && isOverdue(p, today));
  return {
    installments: overdue,
    count: overdue.length,
    amountCents: overdue.reduce((sum, p) => sum + outstandingCents(p), 0),
  };
}

export function negotiationInstallments(
  state: OperationSnapshot,
  clientId: string,
  scope: 'overdue' | 'remaining',
  today: string,
) {
  return state.installments
    .filter((p) => p.clientId === clientId)
    .filter((p) => outstandingCents(p) > 0 && p.status !== 'cancelled')
    .filter((p) => scope === 'remaining' || isOverdue(p, today));
}
