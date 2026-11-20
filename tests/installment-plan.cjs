const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildInstallmentPlan } = require('../.test-build/installment-plan');

test('vencimentos mensais preservam dia do contrato mesmo após fevereiro', () => {
  const rows = buildInstallmentPlan({
    purchaseDescription: 'Curso',
    installmentCount: 4,
    installmentAmountCents: 12500,
    frequency: 'monthly',
    dueDay: 31,
    firstDueDate: '2027-01-31',
  });
  assert.deepEqual(rows.map((row) => row.dueDate), [
    '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30',
  ]);
  assert.equal(rows.reduce((sum, row) => sum + row.amountCents, 0), 50000);
});

test('quinzenal são 15 dias corridos', () => {
  const rows = buildInstallmentPlan({
    purchaseDescription: '',
    installmentCount: 3,
    installmentAmountCents: 5000,
    frequency: 'biweekly',
    dueDay: null,
    firstDueDate: '2026-12-05',
  });
  assert.deepEqual(rows.map((row) => row.dueDate), [
    '2026-12-05', '2026-12-20', '2027-01-04',
  ]);
});

test('sem valor ou vencimento não há parcelas', () => {
  assert.throws(() => buildInstallmentPlan({
    purchaseDescription: '',
    installmentCount: 12,
    installmentAmountCents: null,
    frequency: 'monthly',
    dueDay: 5,
    firstDueDate: '2026-12-05',
  }), /Informe quantidade/);
});
