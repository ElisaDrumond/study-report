const { test } = require('node:test');
const assert = require('node:assert/strict');
const { exportClientsCsv, parseClientsCsv } = require('../.test-build/client-csv');

test('exportar e importar clientes em CSV preserva IDs e campos editáveis', () => {
  const clients = [{
    id: 'c1',
    name: 'Maria, Silva',
    crmRef: 'CRM-1',
    notes: 'Linha 1\nLinha 2; com aspas "ok"',
    financialStatus: 'current',
    serviceStatus: 'active',
    createdAt: '2026-01-01T00:00:00Z',
  }];
  const exported = exportClientsCsv(clients, []);
  assert.deepEqual(parseClientsCsv(exported), [{
    id: 'c1',
    name: 'Maria, Silva',
    crmRef: 'CRM-1',
    notes: 'Linha 1\nLinha 2; com aspas "ok"',
  }]);
});

test('CSV de contrato mantém quantidade, frequência e dia habitual de vencimento', () => {
  const clients = [{
    id: 'a',
    name: 'Ana',
    crmRef: '',
    notes: '',
    financialStatus: 'current',
    serviceStatus: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    paymentTerms: {
      purchaseDescription: 'Treinamento profissional',
      installmentCount: 12,
      frequency: 'monthly',
      dueDay: 5,
      firstDueDate: '2026-12-05',
    },
  }];
  const [row] = parseClientsCsv(exportClientsCsv(clients, []));
  assert.equal(row.purchaseDescription, 'Treinamento profissional');
  assert.equal(row.installmentCount, '12');
  assert.equal(row.frequency, 'monthly');
  assert.equal(row.dueDay, '5');
  assert.equal(row.firstDueDate, '2026-12-05');
});

test('CSV simples permite importar nomes de uma lista externa', () => {
  assert.deepEqual(parseClientsCsv('Nome;Referência CRM\nAna;CRM-A\nBruna;CRM-B'), [
    { id: '', name: 'Ana', crmRef: 'CRM-A', notes: '' },
    { id: '', name: 'Bruna', crmRef: 'CRM-B', notes: '' },
  ]);
});

test('importação CSV rejeita cabeçalhos ausentes e registros incompletos', () => {
  assert.throws(() => parseClientsCsv('CRM;Notas\n1;Oi'), /coluna Nome/);
  assert.throws(() => parseClientsCsv('Nome;CRM\n;1'), /nome inválido/);
});
