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
