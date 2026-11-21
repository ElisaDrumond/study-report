const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Central não oculta todas as tarefas futuras na seleção inicial', () => {
  const controller = fs.readFileSync(
    path.join(__dirname, '../src/features/operations/use-operations.ts'),
    'utf8',
  );
  const panel = fs.readFileSync(
    path.join(__dirname, '../src/features/operations/central-panel.tsx'),
    'utf8',
  );
  assert.match(controller, /\[range, setRange\] = useState\('week'\)/);
  assert.match(controller, /range === 'week' && t\.dueDate <= shiftDate\(today, 7\)/);
  assert.match(panel, /Ver todas as tarefas programadas/);
  assert.match(panel, /Gere as parcelas pelo histórico do cliente/);
  assert.match(panel, /aguardando conferência inicial/);
  assert.match(panel, /operationsState\.pending\.filter/);
});
