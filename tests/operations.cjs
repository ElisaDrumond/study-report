const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const calendar = require('../.test-build/business-calendar');
const { generateCollectionTasks } = require('../.test-build/collection-rules');
const { reconcileTasks } = require('../.test-build/task-generator');
const { defaultSettings } = require('../.test-build/collection-types');
const { migrateOperations } = require('../.test-build/operations-migration');
const { migrateReports } = require('../.test-build/db');
const { mutateOperation, processOperations, snapshot } = require('../.test-build/operations-store');
const { buildOperationalReport } = require('../.test-build/operational-reports');
const { isLocalRequest } = require('../.test-build/local-request');
const client = {
  id: 'c',
  name: 'Cliente Teste',
  crmRef: 'CRM1',
  financialStatus: 'current',
  serviceStatus: 'active',
  notes: '',
  createdAt: '2026-01-01T12:00:00Z',
};
const installment = (overrides = {}) => ({
  id: 'p',
  clientId: 'c',
  reference: 'Contrato 1',
  number: 1,
  amountCents: 10000,
  dueDate: '2026-11-20',
  paidDate: '',
  paidCents: 0,
  status: 'open',
  chargesCents: 0,
  chargeStatus: 'verify',
  scheduledDate: '',
  createdAt: '2026-11-01T12:00:00Z',
  ...overrides,
});
const state = (overrides = {}) => ({
  clients: [client],
  installments: [installment()],
  activities: [],
  pending: [],
  negotiations: [],
  exceptions: [],
  audit: [],
  settings: { ...defaultSettings },
  ...overrides,
});
const exception = (date, type = 'non_business') => ({
  id: date,
  date,
  type,
  description: 'Exceção de teste',
  createdAt: '2026-01-01T12:00:00Z',
});
function memory(s = state()) {
  const db = new Database(':memory:');
  db.exec(
    "CREATE TABLE entries(id TEXT,name TEXT);INSERT INTO entries VALUES('legacy','Legado');CREATE TABLE reports(id TEXT,body TEXT);INSERT INTO reports VALUES('old','Relatório antigo')",
  );
  migrateReports(db);
  migrateOperations(db);
  for (const [key, table] of Object.entries({
    clients: 'op_clients',
    installments: 'op_installments',
    activities: 'op_activities',
    pending: 'op_pending',
    negotiations: 'op_negotiations',
    exceptions: 'op_calendar',
  }))
    for (const value of s[key])
      db.prepare(`INSERT INTO ${table} VALUES(?,?)`).run(value.id, JSON.stringify(value));
  return db;
}
const tasks = (s, today = '2026-11-23') => generateCollectionTasks(s, today);
const kind = (rows, name) => rows.find((t) => t.kind === name);
const payment = (db, overrides = {}) =>
  mutateOperation(
    {
      type: 'confirm_payment',
      installmentId: 'p',
      amountCents: 10000,
      paidDate: '2026-11-20',
      confirmed: true,
      responsible: 'Operadora',
      ...overrides,
    },
    db,
    '2026-11-20',
  );
test('calendário: sexta-feira, feriado segunda, recesso e sábado útil', () => {
  assert.equal(
    calendar.operationToday('America/Sao_Paulo', new Date('2026-11-21T01:00:00Z')),
    '2026-11-20',
  );
  assert.equal(calendar.nextBusinessDay('2026-11-20'), '2026-11-23');
  assert.equal(calendar.nextBusinessDay('2026-11-20', [exception('2026-11-23')]), '2026-11-24');
  assert.equal(
    calendar.addBusinessDays('2026-11-20', 2, [exception('2026-11-23'), exception('2026-11-24')]),
    '2026-11-26',
  );
  assert.equal(
    calendar.nextBusinessDay('2026-11-20', [exception('2026-11-21', 'business')]),
    '2026-11-21',
  );
  assert.equal(calendar.getBusinessDaysBetween('2026-11-20', '2026-11-24'), 2);
  assert.equal(calendar.getBusinessDaysBetween('2026-11-24', '2026-11-20'), -2);
  assert.equal(calendar.getNextCollectionDate('2026-11-22'), '2026-11-23');
  assert.equal(calendar.shiftDate('2026-11-20', 1), '2026-11-21');
});
test('janela termina na sexta, cobrança somente na segunda seguinte', () => {
  const rows = tasks(
    state({ installments: [installment({ dueDate: '2026-11-17' })] }),
    '2026-11-23',
  );
  assert.equal(kind(rows, 'initial').dueDate, '2026-11-18');
  assert.equal(kind(rows, 'window').dueDate, '2026-11-23');
});
test('D-15 e vencimento não úteis antecipam ao útil anterior', () => {
  const rows = tasks(state({ installments: [installment({ dueDate: '2026-11-22' })] }));
  assert.equal(kind(rows, 'advance').dueDate, '2026-11-06');
  assert.equal(kind(rows, 'due').dueDate, '2026-11-20');
  assert.equal(kind(rows, 'initial').dueDate, '2026-11-23');
});
test('pagamento antecipado não gera cobrança; não assume quitação por agendamento', () => {
  assert.equal(
    tasks(
      state({
        installments: [installment({ status: 'paid', paidCents: 10000, paidDate: '2026-11-19' })],
      }),
    ).length,
    0,
  );
  const s = state({ installments: [installment({ scheduledDate: '2026-11-20' })] });
  const monday = tasks(s, '2026-11-23');
  assert.equal(kind(monday, 'scheduled_check').dueDate, '2026-11-23');
  assert(!kind(monday, 'scheduled_alert'));
  assert(!kind(monday, 'initial'));
  const tuesday = tasks(s, '2026-11-24');
  assert.equal(kind(tuesday, 'scheduled_alert').dueDate, '2026-11-24');
  assert(!kind(tuesday, 'alternate'));
  assert(!kind(tuesday, 'initial'));
});
test('duas parcelas: atraso real da mais antiga, não 30 dias presumidos', () => {
  const rows = tasks(
    state({
      installments: [
        installment({ dueDate: '2026-11-02' }),
        installment({ id: 'p2', number: 2, dueDate: '2026-11-18' }),
      ],
    }),
    '2026-11-20',
  );
  assert(kind(rows, 'renegotiate').reason.includes('18 dias'));
  assert(!kind(rows, 'renegotiate').reason.includes('30 dias'));
});
const negotiation = (status, overrides = {}) => ({
  id: 'n',
  clientId: 'c',
  installmentIds: ['p'],
  requestedDate: '2026-11-02',
  proposal: 'Proposta em análise',
  status,
  approvedDate: '',
  authorizedTerms: '',
  suspensionUntil: '',
  createdAt: '2026-11-02T12:00:00Z',
  ...overrides,
});
test('aprovação pendente suspende cobranças apenas das parcelas envolvidas', () => {
  const s = state({
    installments: [
      installment({ dueDate: '2026-11-02' }),
      installment({ id: 'p2', number: 2, dueDate: '2026-11-03' }),
    ],
    negotiations: [negotiation('awaiting_approval')],
  });
  const rows = tasks(s, '2026-11-20');
  assert(
    !rows.some(
      (t) => t.installmentId === 'p' && ['initial', 'window', 'alternate'].includes(t.kind),
    ),
  );
  assert(rows.some((t) => t.installmentId === 'p2' && t.kind === 'initial'));
  assert(kind(rows, 'management'));
});
test('proposta não aprovada e suspensão expirada retomam cobrança em úteis alternados', () => {
  const contact = {
    id: 'a',
    clientId: 'c',
    installmentId: 'p',
    action: 'contact',
    contact: true,
    date: '2026-11-16',
    occurredAt: '2026-11-16T12:00:00Z',
  };
  for (const n of [
    negotiation('not_approved'),
    negotiation('awaiting_approval', { suspensionUntil: '2026-11-15' }),
  ]) {
    const rows = tasks(
      state({
        installments: [installment({ dueDate: '2026-11-02' })],
        negotiations: [n],
        activities: [contact],
      }),
      '2026-11-20',
    );
    assert.equal(kind(rows, 'alternate').dueDate, '2026-11-18');
  }
});
test('pagamento não localizado precede novo contato; contato é histórico imutável', () => {
  const db = memory(state({ installments: [installment({ scheduledDate: '2026-11-20' })] }));
  assert.throws(
    () =>
      mutateOperation(
        { type: 'payment_not_found', installmentId: 'p', responsible: 'Teste' },
        db,
        '2026-11-20',
      ),
    /Aguarde/,
  );
  assert.throws(
    () =>
      mutateOperation(
        {
          type: 'record_contact',
          clientId: 'c',
          installmentId: 'p',
          channel: 'whatsapp',
          result: 'Contato',
          responsible: 'Teste',
        },
        db,
        '2026-11-23',
      ),
    /Confira primeiro/,
  );
  const next = mutateOperation(
    { type: 'payment_not_found', installmentId: 'p', responsible: 'Teste' },
    db,
    '2026-11-23',
  );
  assert(
    kind(
      next.pending.filter((t) => t.status === 'open'),
      'initial',
    ),
  );
  assert.throws(() => db.prepare('UPDATE op_activities SET data=data').run(), /imutável/);
  assert.throws(() => db.prepare('DELETE FROM op_activities').run(), /imutável/);
  db.close();
});
test('pagamento parcial mantém saldo e outras parcelas; quitação é por parcela', () => {
  const db = memory(
    state({
      installments: [
        installment({ dueDate: '2026-11-10' }),
        installment({ id: 'p2', number: 2, dueDate: '2026-11-12' }),
      ],
    }),
  );
  let next = payment(db, { amountCents: 4000 });
  assert.equal(next.installments[0].status, 'partial');
  assert.equal(next.installments[0].paidCents, 4000);
  assert.equal(next.installments[1].paidCents, 0);
  assert.equal(next.clients[0].financialStatus, 'overdue');
  next = payment(db, { amountCents: 6000 });
  assert.equal(next.installments[0].status, 'paid');
  assert.equal(next.installments[1].status, 'open');
  assert(
    !next.pending.some(
      (t) =>
        t.installmentId === 'p' &&
        ['initial', 'window', 'advance'].includes(t.kind) &&
        t.status === 'open',
    ),
  );
  assert.equal(next.clients[0].financialStatus, 'overdue');
  db.close();
});
test('bloqueio/desbloqueio exige confirmação e regularização ou decisão autorizada', () => {
  const db = memory(
    state({
      clients: [{ ...client, serviceStatus: 'blocked' }],
      installments: [installment({ dueDate: '2026-11-10' })],
    }),
  );
  assert.throws(
    () =>
      mutateOperation(
        { type: 'service', clientId: 'c', serviceStatus: 'active', responsible: 'Teste' },
        db,
        '2026-11-20',
      ),
    /confirmação/,
  );
  assert.throws(
    () =>
      mutateOperation(
        {
          type: 'service',
          clientId: 'c',
          serviceStatus: 'active',
          responsible: 'Teste',
          confirmed: true,
        },
        db,
        '2026-11-20',
      ),
    /parcelas vencidas/,
  );
  let next = payment(db);
  assert.equal(next.clients[0].serviceStatus, 'unblock_pending');
  assert(next.pending.some((t) => t.kind === 'unblock' && t.status === 'open'));
  next = mutateOperation(
    {
      type: 'service',
      clientId: 'c',
      serviceStatus: 'active',
      responsible: 'Teste',
      confirmed: true,
    },
    db,
    '2026-11-20',
  );
  assert.equal(next.clients[0].serviceStatus, 'active');
  assert(!next.pending.some((t) => t.kind === 'unblock' && t.status === 'open'));
  db.close();
});
test('reprocessar não duplica nem recria tarefas concluídas', () => {
  const db = memory();
  let s = processOperations(db, '2026-11-20');
  const task = kind(s.pending, 'advance');
  s = mutateOperation(
    {
      type: 'complete_task',
      taskId: task.id,
      channel: 'both',
      result: 'E-mail e WhatsApp enviados manualmente',
      responsible: 'Teste',
    },
    db,
    '2026-11-20',
  );
  const count = s.pending.length,
    audits = s.audit.length;
  for (let i = 0; i < 3; i++) s = processOperations(db, '2026-11-20');
  assert.equal(s.pending.length, count);
  assert.equal(s.audit.length, audits);
  assert.equal(s.pending.find((t) => t.id === task.id).status, 'done');
  db.close();
});
test('alterar/excluir exceção recalcula abertas, preserva concluídas e registra histórico', () => {
  const db = memory();
  let s = processOperations(db, '2026-11-20');
  const advance = kind(s.pending, 'advance'),
    due = kind(s.pending, 'due');
  s = mutateOperation(
    {
      type: 'complete_task',
      taskId: advance.id,
      channel: 'both',
      result: 'Envio realizado',
      responsible: 'Teste',
    },
    db,
    '2026-11-20',
  );
  const completed = { ...s.pending.find((t) => t.id === advance.id) };
  s = mutateOperation(
    {
      type: 'save_calendar',
      date: '2026-11-20',
      exceptionType: 'non_business',
      description: 'Recesso',
    },
    db,
    '2026-11-20',
  );
  assert.equal(s.pending.find((t) => t.id === due.id).dueDate, '2026-11-19');
  assert.deepEqual(
    s.pending.find((t) => t.id === advance.id),
    completed,
  );
  const exception = s.exceptions[0];
  s = mutateOperation(
    {
      type: 'save_calendar',
      id: exception.id,
      date: '2026-11-20',
      exceptionType: 'business',
      description: 'Expediente',
    },
    db,
    '2026-11-20',
  );
  assert.equal(s.pending.find((t) => t.id === due.id).dueDate, '2026-11-20');
  s = mutateOperation({ type: 'delete_calendar', id: exception.id }, db, '2026-11-20');
  assert.equal(s.exceptions.length, 0);
  assert.equal(s.pending.find((t) => t.id === advance.id).status, 'done');
  assert(s.audit.some((a) => a.entity === 'pending'));
  db.close();
});
test('recesso em período e sábado útil persistem; adiamento guarda data solicitada', () => {
  const db = memory();
  let s = processOperations(db, '2026-11-20');
  const task = kind(s.pending, 'due');
  s = mutateOperation(
    {
      type: 'defer_task',
      taskId: task.id,
      dueDate: '2026-11-23',
      reason: 'Aguardar retorno autorizado',
    },
    db,
    '2026-11-20',
  );
  s = mutateOperation(
    {
      type: 'save_calendar',
      date: '2026-11-23',
      endDate: '2026-11-24',
      exceptionType: 'non_business',
      description: 'Recesso',
    },
    db,
    '2026-11-20',
  );
  assert.equal(s.pending.find((t) => t.id === task.id).dueDate, '2026-11-25');
  for (const e of s.exceptions)
    s = mutateOperation({ type: 'delete_calendar', id: e.id }, db, '2026-11-20');
  assert.equal(s.pending.find((t) => t.id === task.id).dueDate, '2026-11-23');
  s = mutateOperation(
    {
      type: 'save_calendar',
      date: '2026-11-21',
      exceptionType: 'business',
      description: 'Sábado útil',
    },
    db,
    '2026-11-20',
  );
  assert(calendar.isBusinessDay('2026-11-21', s.exceptions));
  db.close();
});
test('renegociação exige aprovação anterior e registra responsável', () => {
  const db = memory();
  const base = {
    type: 'save_negotiation',
    clientId: 'c',
    installmentIds: ['p'],
    requestedDate: '2026-11-20',
    proposal: 'Condições propostas',
    responsible: 'Gestão',
  };
  assert.throws(
    () => mutateOperation({ ...base, status: 'approved' }, db, '2026-11-20'),
    /Aprovação|inválid/,
  );
  assert.throws(
    () =>
      mutateOperation(
        {
          ...base,
          status: 'agreement_active',
          approvedDate: '2026-11-20',
          authorizedTerms: 'Aprovado',
          confirmed: true,
        },
        db,
        '2026-11-20',
      ),
    /primeiro|antes/,
  );
  let s = mutateOperation({ ...base, status: 'awaiting_approval' }, db, '2026-11-20');
  assert.equal(s.negotiations[0].approvedDate, '');
  s = mutateOperation(
    {
      ...base,
      id: s.negotiations[0].id,
      status: 'approved',
      approvedDate: '2026-11-20',
      authorizedTerms: 'Autorização da gestão',
      confirmed: true,
    },
    db,
    '2026-11-20',
  );
  s = mutateOperation(
    {
      ...base,
      id: s.negotiations[0].id,
      status: 'agreement_active',
      approvedDate: '2026-11-20',
      authorizedTerms: 'Autorização da gestão',
      confirmed: true,
    },
    db,
    '2026-11-20',
  );
  assert.equal(s.negotiations[0].status, 'agreement_active');
  assert.equal(s.installments[0].amountCents, 10000);
  db.close();
});
test('encaminhamento externo exclusivamente manual com justificativa e responsável', () => {
  const db = memory();
  assert.throws(
    () => mutateOperation({ type: 'external', clientId: 'c' }, db, '2026-11-20'),
    /confirmação/,
  );
  assert.throws(
    () =>
      mutateOperation(
        { type: 'external', clientId: 'c', confirmed: true, responsible: 'Teste' },
        db,
        '2026-11-20',
      ),
    /Justificativa/,
  );
  const s = mutateOperation(
    {
      type: 'external',
      clientId: 'c',
      confirmed: true,
      responsible: 'Teste',
      notes: 'Decisão autorizada registrada no CRM',
    },
    db,
    '2026-11-20',
  );
  assert.equal(s.clients[0].financialStatus, 'external');
  assert.equal(s.pending.filter((t) => t.status === 'open').length, 0);
  assert.equal(s.activities[0].responsible, 'Teste');
  db.close();
});
test('migração idempotente preserva registros e relatórios legados', () => {
  const db = memory();
  migrateOperations(db);
  migrateReports(db);
  assert.equal(db.prepare('SELECT body FROM reports').get().body, 'Relatório antigo');
  assert.equal(db.prepare('SELECT name FROM entries').get().name, 'Legado');
  mutateOperation({ type: 'import_legacy_clients' }, db, '2026-11-20');
  mutateOperation({ type: 'import_legacy_clients' }, db, '2026-11-20');
  assert.equal(snapshot(db).clients.filter((c) => c.name === 'Legado').length, 1);
  assert.equal(snapshot(db).installments.length, 1);
  db.close();
});
test('relatório distingue sugestões e carteira de fatos; cliente único não duplica', () => {
  const s = state({ today: '2026-11-20', installments: [installment({ dueDate: '2026-11-10' })] });
  s.pending = tasks(s, '2026-11-20');
  const before = buildOperationalReport('2026-11-20', s, [], []);
  assert.equal(before.dailyActions, 0);
  assert(before.body.includes('não contabilizadas como realizadas'));
  s.activities = [
    {
      id: 'a',
      clientId: 'c',
      installmentId: 'p',
      category: 'operational',
      action: 'contact',
      status: 'awaiting_reply',
      occurredAt: '2026-11-20T12:00:00Z',
      date: '2026-11-20',
      channel: 'whatsapp',
      notes: '',
      result: 'Contato efetivamente realizado',
      responsible: 'Teste',
      contact: true,
      taskId: '',
      amountCents: 0,
    },
  ];
  const after = buildOperationalReport('2026-11-20', s, [], []);
  assert.equal(after.dailyActions, 1);
  assert.equal(after.uniqueClients, 1);
  assert(after.body.includes('Contato efetivamente realizado'));
  s.activities.push({ ...s.activities[0], id: 'a2' });
  assert.equal(buildOperationalReport('2026-11-20', s, [], []).uniqueClients, 1);
});
test('registros incompletos não originam tarefas e multas não alteram valores', () => {
  for (const p of [
    installment({ dueDate: '' }),
    installment({ amountCents: 0 }),
    installment({ clientId: 'inexistente' }),
  ])
    assert.equal(tasks(state({ installments: [p] })).length, 0);
  const p = installment({ dueDate: '2026-11-10' });
  const rows = tasks(state({ installments: [p] }), '2026-11-20');
  assert(kind(rows, 'fine').reason.includes('10%'));
  assert.equal(p.chargesCents, 0);
});
test('contatos legados vinculados por nome único orientam o ciclo sem duplicar o relatório', () => {
  const db = memory(state({ installments: [installment({ dueDate: '2026-11-02' })] }));
  db.exec(
    'DROP TABLE entries; CREATE TABLE entries(id TEXT,name TEXT,category TEXT,action TEXT,status TEXT,date TEXT,days INTEGER,lastContact TEXT,scheduled TEXT,notes TEXT)',
  );
  const legacy = {
    id: 'old-contact',
    name: client.name,
    category: 'current',
    action: 'whatsapp_sent',
    status: 'awaiting_reply',
    date: '2026-11-16',
    days: null,
    lastContact: '',
    scheduled: '',
    notes: 'Contato legado',
  };
  db.prepare(
    'INSERT INTO entries VALUES(@id,@name,@category,@action,@status,@date,@days,@lastContact,@scheduled,@notes)',
  ).run(legacy);
  let s = processOperations(db, '2026-11-20');
  assert.equal(kind(s.pending, 'alternate').dueDate, '2026-11-18');
  assert.equal(s.activities[0].source, 'legacy');
  assert.equal(buildOperationalReport('2026-11-16', s, [legacy], []).dailyActions, 1);
  s = mutateOperation(
    { type: 'save_client', id: 'c', name: 'Nome atualizado', crmRef: 'CRM1' },
    db,
    '2026-11-20',
  );
  assert.equal(s.activities[0].clientId, 'c');
  assert.equal(s.activities[0].source, 'legacy');
  db.close();
});
test('reenvio da mesma confirmação não duplica pagamento; erros revertem a transação', () => {
  const db = memory();
  const command = {
    type: 'confirm_payment',
    operationId: 'payment-unique',
    installmentId: 'p',
    amountCents: 4000,
    paidDate: '2026-11-20',
    confirmed: true,
    responsible: 'Teste',
  };
  let s = mutateOperation(command, db, '2026-11-20');
  s = mutateOperation(command, db, '2026-11-20');
  assert.equal(s.installments[0].paidCents, 4000);
  assert.equal(s.activities.filter((a) => a.action === 'payment_confirmed').length, 1);
  assert.throws(
    () => mutateOperation({ ...command, amountCents: 5000 }, db, '2026-11-20'),
    /outra operação/,
  );
  assert.throws(() => payment(db, { amountCents: 1000, responsible: '' }), /Responsável/);
  assert.equal(snapshot(db).installments[0].paidCents, 4000);
  db.close();
});
test('pagamento de caso externo ainda gera comprovante/CRM e regulariza saldo', () => {
  const db = memory(
    state({
      clients: [{ ...client, financialStatus: 'external', serviceStatus: 'blocked' }],
      installments: [installment({ dueDate: '2026-11-10' })],
    }),
  );
  const s = payment(db);
  assert.equal(s.clients[0].financialStatus, 'current');
  assert.equal(s.clients[0].serviceStatus, 'unblock_pending');
  assert(s.pending.some((t) => t.kind === 'receipt' && t.status === 'open'));
  assert(s.pending.some((t) => t.kind === 'crm' && t.status === 'open'));
  db.close();
});
test('desbloqueio autorizado preserva a decisão humana enquanto regulariza a carteira', () => {
  const db = memory(
    state({
      clients: [{ ...client, serviceStatus: 'blocked' }],
      installments: [installment({ dueDate: '2026-11-10' })],
    }),
  );
  let s = mutateOperation(
    {
      type: 'service',
      clientId: 'c',
      serviceStatus: 'active',
      responsible: 'Gestão',
      confirmed: true,
      authorizedOverride: true,
      notes: 'Decisão autorizada registrada no CRM',
    },
    db,
    '2026-11-20',
  );
  assert.equal(s.clients[0].serviceStatus, 'active');
  s = processOperations(db, '2026-11-23');
  assert.equal(s.clients[0].serviceStatus, 'active');
  assert(!s.pending.some((t) => t.kind === 'block' && t.status === 'open'));
  db.close();
});
test('origem do navegador usa Host público, mesmo com hostname interno diferente no Next', () => {
  const request = (host, origin) =>
    new Request('http://localhost:3190/api/operations', { headers: { host, origin } });
  assert(isLocalRequest(request('127.0.0.1:3190', 'http://127.0.0.1:3190')));
  assert(isLocalRequest(request('localhost:3190', 'http://localhost:3190')));
  assert(!isLocalRequest(request('127.0.0.1:3190', 'https://example.org')));
  assert(!isLocalRequest(request('example.org', 'https://example.org')));
  assert(!isLocalRequest(request('localhost:3190', 'null')));
  assert(!isLocalRequest(request('localhost:3190', 'http://localhost:3191')));
});
