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
  assert.match(history, /openClient\('generate_installments', 'Revisar e gerar parcelas', client\)/);
  assert.doesNotMatch(history, /window\.confirm\(/);
  assert.doesNotMatch(history, /\brun\(\{/);
  assert.match(dialog, /activeDialog\.type === 'generate_installments'/);
  assert.match(dialog, /name="reference"/);
  assert.match(dialog, /name="confirmed"/);
});
