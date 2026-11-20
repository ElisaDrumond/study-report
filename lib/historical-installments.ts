import type { Installment } from './collection-types';
import type { InstallmentPreview } from './installment-plan';
import { isDate } from './rules';

export type HistoricPaymentInput = {
  number: number;
  paidDate: string;
  paidCents: number;
  chargesCents: number;
};

/**
 * Historical receipts may only be reconciled during initial generation,
 * when the installment is still absent from the ledger. Do not treat the
 * entry as a payment action performed on the import date.
 */
export function validateHistoricalPayments(
  input: unknown,
  plan: InstallmentPreview[],
  today: string,
): Map<number, HistoricPaymentInput> {
  if (input === undefined) return new Map();
  if (!Array.isArray(input) || input.length > plan.length) {
    throw Error('Histórico de pagamentos inválido');
  }
  const known = new Map(plan.map((item) => [item.number, item]));
  const result = new Map<number, HistoricPaymentInput>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw Error('Pagamento histórico inválido');
    }
    const payment = raw as Partial<HistoricPaymentInput>;
    const number = payment.number;
    const draft = known.get(number as number);
    if (!draft || result.has(number as number)) {
      throw Error('Parcela histórica inválida ou repetida');
    }
    if (draft.dueDate >= today) {
      throw Error('Não é permitido importar pagamento histórico de parcela ainda não vencida');
    }
    if (!isDate(String(payment.paidDate ?? '')) || String(payment.paidDate) > today) {
      throw Error('Data efetiva do pagamento histórico inválida');
    }
    const amount = payment.paidCents;
    const charges = payment.chargesCents;
    if (
      !Number.isSafeInteger(amount) ||
      !Number.isSafeInteger(charges) ||
      (amount as number) <= 0 ||
      (charges as number) < 0 ||
      (charges as number) > 100000000000 ||
      (amount as number) !== draft.amountCents + (charges as number)
    ) {
      throw Error(
        `Parcela ${number}: o valor recebido deve corresponder ao valor original + encargos informados. ` +
          'Pagamentos parciais, descontos ou outros ajustes precisam de registro específico.',
      );
    }
    result.set(number as number, {
      number: number as number,
      paidDate: String(payment.paidDate),
      paidCents: amount as number,
      chargesCents: charges as number,
    });
  }
  return result;
}

export function applyHistoricalPayment(
  installment: Installment,
  payment: HistoricPaymentInput | undefined,
): Installment {
  if (!payment) return installment;
  return {
    ...installment,
    paidDate: payment.paidDate,
    paidCents: payment.paidCents,
    chargesCents: payment.chargesCents,
    chargeStatus: payment.chargesCents > 0 ? 'applied' : 'not_applicable',
    status: 'paid',
    verificationStatus: 'verified',
    historicalPaid: true,
  };
}
