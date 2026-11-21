const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('geração de parcelas abre modal padrão sem confirmação nativa ou run externo', () => {
  const history = fs.readFileSync(
    path.join(__dirname, '../src/features/operations/client-history.tsx'),
    'utf8',
  );
  const dialog = fs.readFileSync(
    path.join(__dirname, '../src/features/operations/operation-dialog.tsx'),
    'utf8',
  );
  assert.match(
    history,
    /openClient\('generate_installments', 'Revisar e gerar parcelas', client\)/,
  );
  assert.doesNotMatch(history, /window\.confirm\(/);
  assert.doesNotMatch(history, /\brun\(\{/);
  assert.match(dialog, /activeDialog\.type === 'generate_installments'/);
  assert.match(dialog, /name="reference"/);
  assert.match(dialog, /name="confirmed"/);
});

test('ações de parcelas quitadas não oferecem pagamento ou previsão; opções secundárias ficam agrupadas', () => {
  const history = fs.readFileSync(
    path.join(__dirname, '../src/features/operations/client-history.tsx'),
    'utf8',
  );
  assert.match(history, /p\.status === 'paid' \|\| p\.status === 'cancelled'/);
  assert.match(history, /Nenhuma ação pendente/);
  assert.match(history, /<details className=\{op\.installmentMore\}>/);
  assert.match(history, /<summary>Mais ações<\/summary>/);
  assert.match(history, /p\.verificationStatus === 'unverified'/);
  assert.match(history, /openClient\('confirm_payment'/);
  assert.match(history, /openClient\('schedule_payment'/);
  assert.match(history, /openClient\('save_installment'/);
});
