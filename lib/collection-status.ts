import { calendarDaysBetween } from './business-calendar';
import type { Installment } from './collection-types';
export const negotiationLabels = {
  proposal_received: 'Proposta recebida',
  awaiting_approval: 'Aguardando aprovação',
  approved: 'Aprovada',
  not_approved: 'Não aprovada',
  agreement_active: 'Acordo formalizado',
  cancelled: 'Cancelada',
};
export const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const outstandingCents = (p: Installment) =>
  Math.max(0, p.amountCents + (p.chargeStatus === 'applied' ? p.chargesCents : 0) - p.paidCents);
export const isUnpaid = (p: Installment) =>
  p.status !== 'cancelled' && p.status !== 'paid' && outstandingCents(p) > 0;
export const isOverdue = (p: Installment, today: string) => isUnpaid(p) && p.dueDate < today;
export const daysOverdue = (p: Installment, today: string) =>
  Math.max(0, calendarDaysBetween(p.dueDate, today));
