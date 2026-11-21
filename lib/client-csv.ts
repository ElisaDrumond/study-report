import type { Client, Installment } from './collection-types';
import { outstandingCents } from './collection-status';
import { parseUSDToCents } from './money-input';

export type ImportedClientRow = {
  id: string;
  name: string;
  crmRef: string;
  notes: string;
  purchaseDescription?: string;
  installmentCount?: string;
  installmentAmountCents?: string;
  frequency?: string;
  dueDay?: string;
  firstDueDate?: string;
};

const header = [
  'ID do cliente',
  'Nome',
  'Referência CRM',
  'Status financeiro',
  'Status atendimento',
  'Total de parcelas',
  'Saldo registrado (USD)',
  'Observações',
  'O que comprou',
  'Quantidade de parcelas contratadas',
  'Valor de cada parcela (USD)',
  'Periodicidade',
  'Dia do vencimento',
  'Primeiro vencimento',
];

function escapeCell(value: string | number) {
  const raw = String(value ?? '');
  // Text coming from CRM must never be evaluated as a spreadsheet formula.
  const safe = /^\s*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function exportClientsCsv(clients: Client[], installments: Installment[]) {
  const rows = clients.map((client) => {
    const relevant = installments.filter(
      (installment) => installment.clientId === client.id && installment.status !== 'cancelled',
    );
    const balance = relevant.reduce(
      (total, installment) => total + outstandingCents(installment),
      0,
    );
    return [
      client.id,
      client.name,
      client.crmRef,
      client.financialStatus,
      client.serviceStatus,
      relevant.length,
      (balance / 100).toFixed(2).replace('.', ','),
      client.notes,
      client.paymentTerms?.purchaseDescription ?? '',
      client.paymentTerms?.installmentCount ?? '',
      client.paymentTerms?.installmentAmountCents
        ? (client.paymentTerms.installmentAmountCents / 100).toFixed(2).replace('.', ',')
        : '',
      client.paymentTerms?.frequency ?? '',
      client.paymentTerms?.dueDay ?? '',
      client.paymentTerms?.firstDueDate ?? '',
    ];
  });
  return '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n');
}

function parseMatrix(text: string) {
  const source = text.replace(/^\uFEFF/, '').replace(/^sep=[;,]\r?\n/i, '');
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter =
    (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && source[index + 1] === '\n') index++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw Error('CSV inválido: aspas sem fechamento');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');

export function parseClientsCsv(source: string): ImportedClientRow[] {
  const matrix = parseMatrix(source);
  if (matrix.length < 2) throw Error('CSV sem clientes para importar');
  const headers = matrix[0].map(normalized);
  const find = (...names: string[]) => headers.findIndex((value) => names.includes(value));
  const nameColumn = find('nome', 'cliente', 'nome do cliente');
  const idColumn = find('id do cliente', 'id', 'clientid');
  const crmColumn = find('referencia crm', 'crm', 'crmref');
  const notesColumn = find('observacoes', 'observacao', 'notas');
  const descriptionColumn = find('o que comprou', 'tipo de negocio', 'negocio contratado');
  const countColumn = find(
    'quantidade de parcelas contratadas',
    'quantidade de parcelas',
    'parcelas contratadas',
  );
  const amountColumn = find('valor de cada parcela (usd)', 'valor da parcela', 'valor por parcela');
  const frequencyColumn = find('periodicidade', 'frequencia');
  const dueDayColumn = find('dia do vencimento', 'dia habitual do vencimento');
  const firstDueDateColumn = find('primeiro vencimento', 'data do primeiro vencimento');
  if (nameColumn < 0) throw Error('O CSV precisa de uma coluna Nome');
  if (matrix.length > 5001) throw Error('Limite de 5.000 clientes por arquivo');

  return matrix.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) {
      throw Error(`Linha ${index + 2}: quantidade incorreta de colunas`);
    }
    const name = cells[nameColumn].trim();
    if (!name || name.length > 250) throw Error(`Linha ${index + 2}: nome inválido`);
    const field = (column: number) => (column < 0 ? '' : cells[column].trim());
    return {
      id: field(idColumn),
      name,
      crmRef: field(crmColumn),
      notes: field(notesColumn),
      ...(field(descriptionColumn) ? { purchaseDescription: field(descriptionColumn) } : {}),
      ...(field(countColumn) ? { installmentCount: field(countColumn) } : {}),
      ...(field(amountColumn)
        ? { installmentAmountCents: String(parseUSDToCents(field(amountColumn))) }
        : {}),
      ...(field(frequencyColumn) ? { frequency: field(frequencyColumn) } : {}),
      ...(field(dueDayColumn) ? { dueDay: field(dueDayColumn) } : {}),
      ...(field(firstDueDateColumn) ? { firstDueDate: field(firstDueDateColumn) } : {}),
    };
  });
}
