'use client';
import { taskLabels } from '../../../lib/collection-rules';
import { negotiationLabels } from '../../../lib/collection-status';
import type {
OperationActivity,
OperationSnapshot
} from '../../../lib/collection-types';
import { defaultSettings } from '../../../lib/collection-types';
import { actions as legacyActions } from '../../../lib/rules';
export const empty: OperationSnapshot = {
  clients: [],
  installments: [],
  activities: [],
  pending: [],
  negotiations: [],
  exceptions: [],
  audit: [],
  settings: defaultSettings,
};
export const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const amountInput = (cents: number) => (cents / 100).toFixed(2);
export function cents(value: FormDataEntryValue | null) {
  const raw = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw Error('Informe valores com até duas casas decimais.');
  const [whole, fraction = ''] = raw.split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(n)) throw Error('Valor inválido');
  return n;
}
export const serviceLabels = {
  active: 'Atendimento ativo',
  block_pending: 'Bloqueio pendente',
  blocked: 'Atendimento bloqueado',
  unblock_pending: 'Desbloqueio pendente',
};
export const financialLabels = {
  current: 'Sem parcela vencida',
  overdue: 'Inadimplente',
  external: 'Cobrança externa',
};
export const activityLabels: Record<string, string> = {
  contact: 'Contato registrado',
  payment_confirmed: 'Conciliação / pagamento confirmado',
  payment_scheduled: 'Agendamento registrado',
  payment_not_found: 'Pagamento não localizado',
  service_blocked: 'Bloqueio confirmado',
  service_unblocked: 'Desbloqueio confirmado',
  external_collection: 'Encaminhamento externo confirmado',
  management_requested: 'Análise solicitada',
};
export const activityLabel = (a: OperationActivity) =>
  activityLabels[a.action] ||
  (a.action.startsWith('negotiation_')
    ? negotiationLabels[a.status as keyof typeof negotiationLabels]
    : null) ||
  legacyActions[a.action as keyof typeof legacyActions] ||
  (taskLabels[a.action] ? 'Conclusão: ' + taskLabels[a.action] : 'Ação registrada');
export const stateLabels = {
  open: 'Aberta',
  deferred: 'Adiada',
  done: 'Concluída',
  cancelled: 'Suspensa / encerrada pela regra',
};
export const channelLabels = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  both: 'E-mail e WhatsApp',
  phone: 'Telefone',
  system: 'Sistema / conferência',
  other: 'Outro',
};