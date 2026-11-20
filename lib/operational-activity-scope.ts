import type { OperationActivity } from './collection-types';

/**
 * Distinguishes actual work from internal portfolio maintenance.
 *
 * The operational ledger/audit remains untouched. This predicate only controls
 * what appears in professional daily reports and the Activities work list.
 * Older entries without a scope get classified by their original action.
 */
export function isReportableOperationalActivity(activity: OperationActivity): boolean {
  if (activity.reportScope === 'administrative') return false;
  if (activity.reportScope === 'work') return true;

  if (activity.action === 'payment_confirmed') {
    // Older records did not store paidDate separately. Recover it from the
    // original confirmation text; an earlier receipt entered today is history,
    // not today's receipt or CRM update.
    const actualPaymentDate = /Data do pagamento:\s*(\d{4}-\d{2}-\d{2})\b/.exec(
      activity.result,
    )?.[1];
    if (actualPaymentDate && actualPaymentDate < activity.date) return false;
    return true;
  }

  if (
    activity.action === 'payment_status_checked' ||
    activity.action === 'task_deferred' ||
    activity.action === 'payment_scheduled' ||
    activity.action === 'portfolio_review'
  )
    return false;

  if (activity.contact) return true;
  if (activity.action.startsWith('negotiation_')) return true;

  return [
    'payment_not_found',
    'service_blocked',
    'service_unblocked',
    'external_collection',
    'management_requested',
    'receipt',
    'crm',
    'advance',
    'due',
    'initial',
    'window',
    'alternate',
    'management',
    'external_review',
    'renegotiate',
    'block',
    'unblock',
  ].includes(activity.action);
}
