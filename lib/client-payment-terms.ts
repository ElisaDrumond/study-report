import { isDate } from './rules';

export type PaymentFrequency = 'monthly' | 'biweekly' | 'weekly' | 'one_time';

export type ClientPaymentTerms = {
  purchaseDescription: string;
  installmentCount: number | null;
  installmentAmountCents: number | null;
  frequency: PaymentFrequency;
  dueDay: number | null;
  firstDueDate: string;
};

const frequencies = new Set<PaymentFrequency>(['monthly', 'biweekly', 'weekly', 'one_time']);

/**
 * Contract terms describe what was agreed, never proof of an installment,
 * payment or debt. Null/empty metadata does not create collection tasks.
 */
export function parsePaymentTerms(raw: unknown): ClientPaymentTerms | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw Error('Condições de pagamento inválidas');
  }

  const input = raw as Record<string, unknown>;
  const description = input.purchaseDescription ?? '';
  const count = input.installmentCount ?? '';
  const amount = input.installmentAmountCents ?? '';
  const frequency = input.frequency ?? 'monthly';
  const day = input.dueDay ?? '';
  const first = input.firstDueDate ?? '';

  if (typeof description !== 'string' || description.length > 500) {
    throw Error('Descrição da compra inválida (máximo 500 caracteres)');
  }
  if (typeof frequency !== 'string' || !frequencies.has(frequency as PaymentFrequency)) {
    throw Error('Periodicidade de pagamento inválida');
  }
  if (typeof first !== 'string' || (first !== '' && !isDate(first))) {
    throw Error('Primeiro vencimento inválido');
  }

  const parseOptionalInt = (value: unknown, field: string, upper: number): number | null => {
    if (value === '' || value === null || value === undefined) return null;
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(number) || number < 1 || number > upper) {
      throw Error(field + ' inválido');
    }
    return number;
  };

  const installmentCount = parseOptionalInt(count, 'Quantidade de parcelas', 240);
  const dueDay = parseOptionalInt(day, 'Dia de vencimento', 31);
  const installmentAmountCents = parseOptionalInt(amount, 'Valor de cada parcela', 100000000000);
  if (dueDay !== null && frequency !== 'monthly') {
    throw Error('Dia fixo de vencimento só se aplica a pagamentos mensais');
  }
  if (frequency === 'one_time' && installmentCount !== null && installmentCount !== 1) {
    throw Error('Pagamento único deve ter apenas uma parcela');
  }

  if (
    !description.trim() &&
    installmentCount === null &&
    installmentAmountCents === null &&
    dueDay === null &&
    !first
  ) {
    return undefined;
  }

  return {
    purchaseDescription: description.trim(),
    installmentCount,
    installmentAmountCents,
    frequency: frequency as PaymentFrequency,
    dueDay,
    firstDueDate: first,
  };
}

/** CSV import is a patch; blank cells never clear existing contract fields. */
export function mergePaymentTerms(
  existing: ClientPaymentTerms | undefined,
  fields: {
    purchaseDescription?: string;
    installmentCount?: string;
    installmentAmountCents?: string;
    frequency?: string;
    dueDay?: string;
    firstDueDate?: string;
  },
) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined && value !== '');
  if (entries.length === 0) return existing;
  return parsePaymentTerms({
    ...(existing ?? {}),
    ...Object.fromEntries(entries),
  });
}
