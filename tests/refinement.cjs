const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const OpenAI = require('openai').default;
const { buildReport } = require('../.test-build/rules');
const { reportSections, applyEditorialPlan } = require('../.test-build/refinement');
const { refineReport } = require('../.test-build/openai-refine');
const { migrateReports } = require('../.test-build/db');
const date = '2026-11-20';
const entry = (overrides = {}) => ({
  id: '1',
  name: 'Cliente Á',
  category: 'current',
  action: 'email_sent',
  status: 'awaiting_reply',
  date,
  days: null,
  lastContact: '',
  scheduled: '',
  notes: 'Valor R$ 1.234,56',
  ...overrides,
});
const rows = [
  entry(),
  entry({ id: '2', action: 'whatsapp_sent' }),
  entry({
    id: '3',
    name: 'Monitorado',
    category: 'late',
    action: 'none',
    status: 'payment_scheduled',
    days: 20,
    scheduled: '2026-11-25',
    lastContact: '2026-11-10',
  }),
  entry({ id: '4', category: 'renegotiation', status: 'awaiting_approval' }),
];
test('normalização preserva vínculo de cliente da carteira', () => {
  const { cleanEntry } = require('../.test-build/rules');
  assert.equal(cleanEntry(entry({ clientId: 'client-123' })).clientId, 'client-123');
  assert.equal(cleanEntry(entry()).clientId, '');
});

const original = buildReport(date, rows, []);
const plan = () => ({ introduction: 0, sections: reportSections(original.body).map((s) => s.id) });
const client = (output, status = 'completed') => ({
  responses: {
    create: async (args) => {
      assert.equal(args.store, false);
      assert(!JSON.stringify(args).includes('Cliente Á'));
      assert(!JSON.stringify(args).includes('1.234'));
      return { status, output_text: output };
    },
  },
});
test('geração tradicional sem chave; múltiplas ações e clientes únicos', () => {
  assert.equal(original.dailyActions, 3);
  assert.equal(original.uniqueClients, 1);
  assert.equal(original.followUps, 1);
});
test('monitoramento sem contato, aprovação pendente e pagamento previsto preservados', () => {
  const out = applyEditorialPlan(original, plan(), 'formal');
  for (const s of reportSections(original.body)) assert(out.body.includes(s.content));
  assert(out.body.includes('Aguardando aprovação'));
  assert(out.body.includes('25/11/2026'));
  assert(!out.body.includes('Monitorado — E-mail enviado'));
});
test('resposta válida nos três estilos sem transmitir fatos', async () => {
  for (const style of ['formal', 'executive', 'detailed'])
    assert.equal(
      (await refineReport(original, style, client(JSON.stringify(plan())))).subject,
      original.subject,
    );
});
test('chave ausente', async () => {
  const old = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(refineReport(original, 'formal'), /Configure OPENAI_API_KEY/);
  } finally {
    if (old) process.env.OPENAI_API_KEY = old;
  }
});
test('falha de conexão e timeout', async () => {
  for (const error of [new OpenAI.APIConnectionError({}), new OpenAI.APIConnectionTimeoutError()])
    await assert.rejects(
      refineReport(original, 'formal', {
        responses: {
          create: async () => {
            throw error;
          },
        },
      }),
      /conexão|indisponibilidade/,
    );
});
test('chave inválida', async () => {
  await assert.rejects(
    refineReport(original, 'formal', {
      responses: {
        create: async () => {
          throw new OpenAI.AuthenticationError(401, {}, 'invalid', new Headers());
        },
      },
    }),
    /Chave OpenAI inválida/,
  );
});
test('respostas vazias, malformadas, incompletas e divergentes rejeitadas', async () => {
  for (const output of [
    '',
    '{',
    '{}',
    JSON.stringify({ ...plan(), sections: [] }),
    JSON.stringify({ ...plan(), names: ['Outro'] }),
    JSON.stringify({ ...plan(), introduction: 9 }),
  ])
    await assert.rejects(refineReport(original, 'formal', client(output)));
  await assert.rejects(
    refineReport(original, 'formal', client(JSON.stringify(plan()), 'incomplete')),
  );
});
test('alterações de nomes, datas, valores e indicadores não entram no plano', () => {
  for (const field of ['name', 'date', 'value', 'dailyActions'])
    assert.throws(() =>
      applyEditorialPlan(original, { ...plan(), [field]: 'inventado' }, 'formal'),
    );
  assert.throws(() => applyEditorialPlan(original, { ...plan(), sections: ['fake'] }, 'formal'));
});
test('relatório sem seções', () => {
  const empty = buildReport(date, [], []);
  assert.equal(reportSections(empty.body).length, 0);
  assert(
    applyEditorialPlan(empty, { introduction: 0, sections: [] }, 'formal').body.includes(
      'Elisa Anjo',
    ),
  );
});
test('migração SQLite idempotente preserva histórico e outros registros', () => {
  const db = new Database(':memory:');
  db.exec(
    "CREATE TABLE reports(id TEXT,body TEXT); INSERT INTO reports VALUES('old','original'); CREATE TABLE entries(id TEXT); INSERT INTO entries VALUES('cliente')",
  );
  migrateReports(db);
  migrateReports(db);
  assert.equal(db.prepare('SELECT body FROM reports').get().body, 'original');
  assert.equal(db.prepare('SELECT count(*) n FROM entries').get().n, 1);
  db.prepare('UPDATE reports SET refinedBody=?, refinementStyle=?').run('refinado', 'formal');
  assert.equal(db.prepare('SELECT refinedBody FROM reports').get().refinedBody, 'refinado');
  db.close();
});
