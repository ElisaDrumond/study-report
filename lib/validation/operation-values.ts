import { isDate } from '../rules';
export const text = (value: unknown, label: string, required = false) => {
  if (typeof value !== 'string' || value.length > 10000 || (required && !value.trim()))
    throw Error(label + ' inválido');
  return value.trim();
};
export const date = (value: unknown, label = 'Data') => {
  if (typeof value !== 'string' || !isDate(value)) throw Error(label + ' inválida');
  return value;
};
export const money = (value: unknown, label = 'Valor') => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 100000000000
  )
    throw Error(label + ' inválido (use centavos inteiros)');
  return value;
};
export function pick<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw Error(label + ' inválido');
  return value as T;
}
