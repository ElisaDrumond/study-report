import { isDate } from './rules';
export type CalendarException = {
  id: string;
  date: string;
  type: 'non_business' | 'business';
  description: string;
  createdAt: string;
};
export const operationToday = (timezone = 'America/Sao_Paulo', instant = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
export function shiftDate(date: string, days: number) {
  if (!isDate(date) || !Number.isInteger(days)) throw Error('Data ou prazo inválido');
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d + days));
  return value.toISOString().slice(0, 10);
}
export function calendarDaysBetween(start: string, end: string) {
  if (!isDate(start) || !isDate(end)) throw Error('Data inválida');
  return Math.round((Date.parse(end + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 86400000);
}
export function isBusinessDay(date: string, exceptions: CalendarException[] = []) {
  if (!isDate(date)) throw Error('Data inválida');
  const exception = exceptions.find((e) => e.date === date);
  if (exception) return exception.type === 'business';
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  return day !== 0 && day !== 6;
}
export function addBusinessDays(date: string, days: number, exceptions: CalendarException[] = []) {
  if (!Number.isInteger(days) || Math.abs(days) > 10000) throw Error('Prazo inválido');
  let result = date,
    remaining = Math.abs(days),
    steps = 0;
  while (remaining) {
    if (++steps > 50000) throw Error('Calendário sem disponibilidade');
    result = shiftDate(result, days < 0 ? -1 : 1);
    if (isBusinessDay(result, exceptions)) remaining--;
  }
  return result;
}
export const nextBusinessDay = (date: string, exceptions: CalendarException[] = []) =>
  addBusinessDays(date, 1, exceptions);
export function previousOrSameBusinessDay(date: string, exceptions: CalendarException[] = []) {
  let result = date;
  for (let i = 0; i < 50000; i++) {
    if (isBusinessDay(result, exceptions)) return result;
    result = shiftDate(result, -1);
  }
  throw Error('Calendário sem disponibilidade');
}
export function getNextCollectionDate(date: string, exceptions: CalendarException[] = []) {
  let result = date;
  for (let i = 0; i < 50000; i++) {
    if (isBusinessDay(result, exceptions)) return result;
    result = shiftDate(result, 1);
  }
  throw Error('Calendário sem disponibilidade');
}
// Counts business days in (start, end], with a signed result for reverse ranges.
export function getBusinessDaysBetween(
  start: string,
  end: string,
  exceptions: CalendarException[] = [],
): number {
  if (!isDate(start) || !isDate(end)) throw Error('Data inválida');
  if (start > end) return -getBusinessDaysBetween(end, start, exceptions);
  let count = 0;
  for (let d = shiftDate(start, 1); d <= end; d = shiftDate(d, 1))
    if (isBusinessDay(d, exceptions)) count++;
  return count;
}
