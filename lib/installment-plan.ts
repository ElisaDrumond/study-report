import { shiftDate } from './business-calendar';
import type { ClientPaymentTerms } from './client-payment-terms';
import { isDate } from './rules';

export type InstallmentPreview = { number: number; dueDate: string; amountCents: number };

export function buildInstallmentPlan(terms: ClientPaymentTerms): InstallmentPreview[] {
  const { installmentCount, installmentAmountCents, firstDueDate, frequency, dueDay } = terms;
  if (!installmentCount || !installmentAmountCents || !isDate(firstDueDate)) {
    throw Error('Informe quantidade, valor por parcela e primeiro vencimento');
  }
  if (!Number.isSafeInteger(installmentAmountCents) || installmentAmountCents < 1) {
    throw Error('Valor de parcela inválido');
  }
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 240) {
    throw Error('Quantidade de parcelas inválida');
  }
  const [startYear, startMonth, startDay] = firstDueDate.split('-').map(Number);
  const monthlyDay = dueDay ?? startDay;
  if (
    frequency === 'monthly' &&
    startDay !== Math.min(monthlyDay, new Date(Date.UTC(startYear, startMonth, 0)).getUTCDate())
  ) {
    throw Error('Primeiro vencimento não corresponde ao dia habitual indicado');
  }
  const result: InstallmentPreview[] = [];
  for (let index = 0; index < installmentCount; index++) {
    let date: string;
    if (frequency === 'monthly') {
      const first = new Date(Date.UTC(startYear, startMonth - 1 + index, 1));
      const year = first.getUTCFullYear();
      const month = first.getUTCMonth();
      const day = Math.min(monthlyDay, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
      date = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    } else {
      const days = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 15 : 0;
      date = shiftDate(firstDueDate, index * days);
    }
    result.push({ number: index + 1, dueDate: date, amountCents: installmentAmountCents });
  }
  return result;
}
