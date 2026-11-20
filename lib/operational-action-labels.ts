import { taskLabels } from './collection-rules';
import type { OperationActivity } from './collection-types';

const actionNames: Record<string, string> = {
  contact: 'Contato registrado',
  payment_confirmed: 'Pagamento registrado',
  payment_status_checked: 'Situação financeira verificada',
  payment_scheduled: 'Previsão de pagamento registrada',
  payment_not_found: 'Pagamento não localizado',
  task_deferred: 'Tarefa adiada',
  service_blocked: 'Bloqueio realizado',
  service_unblocked: 'Desbloqueio realizado',
  external_collection: 'Encaminhamento à cobrança externa',
  management_requested: 'Análise solicitada à gestão',
};

export function operationalActionLabel(activity: OperationActivity) {
  if (activity.action === 'payment_confirmed') {
    return activity.status === 'partial' ? 'Pagamento parcial registrado' : 'Pagamento registrado';
  }
  if (activity.action.startsWith('negotiation_')) return 'Renegociação registrada';
  if (taskLabels[activity.action]) return 'Tarefa concluída: ' + taskLabels[activity.action];
  return actionNames[activity.action] || 'Atividade operacional registrada';
}
