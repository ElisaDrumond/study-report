export function parseBRLToCents(input: string): number {
  const value = input
    .trim()
    .replace(/^R\$\s*/, '')
    .replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw Error('Valor da parcela inválido: use 350,00');
  const [integer, fraction = ''] = value.split('.');
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000000) {
    throw Error('Valor da parcela fora do limite');
  }
  return cents;
}
