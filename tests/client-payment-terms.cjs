const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePaymentTerms, mergePaymentTerms } = require('../.test-build/client-payment-terms');

test('condições mensais são guardadas como metadados contratuais', () => {
  const terms = parsePaymentTerms({
    purchaseDescription: 'Curso de soldagem',
    installmentCount: '12',
    frequency: 'monthly',
    dueDay: '5',
    firstDueDate: '2026-12-05',
  });
  assert.deepEqual(terms, {
    purchaseDescription: 'Curso de soldagem',
    installmentCount: 12,
    frequency: 'monthly',
    dueDay: 5,
    firstDueDate: '2026-12-05',
  });
});

test('campos de vencimento e periodicidade rejeitam valores inconsistentes', () => {
  assert.throws(() => parsePaymentTerms({ installmentCount: 0 }), /Quantidade/);
  assert.throws(() => parsePaymentTerms({ dueDay: 32 }), /Dia de vencimento/);
  assert.throws(() => parsePaymentTerms({ frequency: 'weekly', dueDay: 5 }), /mensais/);
  assert.throws(() => parsePaymentTerms({ frequency: 'one_time', installmentCount: 3 }), /único/);
  assert.throws(() => parsePaymentTerms({ firstDueDate: '2026-02-30' }), /Primeiro vencimento/);
});

test('CSV atualiza parcialmente sem apagar detalhes de contratos anteriores', () => {
  const existing = parsePaymentTerms({
    purchaseDescription: 'Curso',
    installmentCount: 8,
    frequency: 'monthly',
    dueDay: 5,
    firstDueDate: '',
  });
  const merged = mergePaymentTerms(existing, { purchaseDescription: 'Curso completo' });
  assert.equal(merged.purchaseDescription, 'Curso completo');
  assert.equal(merged.installmentCount, 8);
  assert.equal(merged.dueDay, 5);
});
