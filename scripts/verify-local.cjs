// Production integration smoke test. All writes use an isolated fixture database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');
const { shiftDate } = require('../.test-build/business-calendar');
const folder = fs.mkdtempSync(path.join(process.cwd(), '.test-build', 'local-'));
const db = new Database(path.join(folder, 'report.db'));
db.exec(`CREATE TABLE entries (id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL,date TEXT NOT NULL,days INTEGER,lastContact TEXT NOT NULL,scheduled TEXT NOT NULL,notes TEXT NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE tasks (id TEXT PRIMARY KEY,title TEXT NOT NULL,status TEXT NOT NULL,details TEXT NOT NULL,date TEXT NOT NULL);
CREATE TABLE reports (id TEXT PRIMARY KEY,date TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,createdAt TEXT NOT NULL);
INSERT INTO entries VALUES('old','Cliente de teste','current','whatsapp_sent','awaiting_reply','2026-11-10',NULL,'','','Contato legado','2026-11-10','2026-11-10');
INSERT INTO reports VALUES('old-report','2026-11-10','Assunto antigo','Texto antigo preservado','2026-11-10');`);
db.close();
const port = 3190,
  base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    require.resolve('next/dist/bin/next'),
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ],
  {
    windowsHide: true,
    env: { ...process.env, STUDY_REPORT_DATA_DIR: folder, OPENAI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
server.stdout.on('data', (b) => (logs += b));
server.stderr.on('data', (b) => (logs += b));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let chrome, ws;
async function api(command) {
  const response = await fetch(base + '/api/operations', {
    method: command ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: command ? JSON.stringify(command) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, 200, data.error);
  return data;
}
async function browser() {
  const chromePath =
    process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=' + path.join(folder, 'chrome'),
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  chrome.on('error', () => {});
  let debugPort;
  for (let i = 0; i < 120; i++) {
    try {
      debugPort = fs
        .readFileSync(path.join(folder, 'chrome', 'DevToolsActivePort'), 'utf8')
        .split('\n')[0];
      break;
    } catch {}
    await pause(250);
  }
  assert(debugPort, 'Chrome did not start');
  const target = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/new?${base}`, { method: 'PUT' })
  ).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map(),
    exceptions = [];
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
      const handler = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) {
        handler.reject(Error(m.error.message));
      } else {
        handler.resolve(m.result);
      }
    }
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.text);
  });
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, { resolve, reject });
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });
  }
  async function evaluate(expression) {
    const value = await cdp('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (value.exceptionDetails) throw Error(value.exceptionDetails.text);
    return value.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 80; i++) {
      if (await evaluate(expression)) return;
      await pause(250);
    }
    const capture = await cdp('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(folder, 'failure.png'), Buffer.from(capture.data, 'base64'));
    throw Error(
      'Browser condition timed out: ' +
        expression +
        '\n' +
        (await evaluate('document.body.innerText.slice(-1800)')),
    );
  }
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp('Page.navigate', { url: base });
  await waitFor("document.body.innerText.includes('Fila operacional')");
  for (const [label, file, expected] of [
    ['Central Operacional', 'central.png', 'Fila operacional'],
    ['Clientes e parcelas', 'clients.png', 'Carteira operacional'],
    ['Calendário Operacional', 'calendar.png', 'Dias úteis e recessos'],
  ]) {
    await evaluate(
      `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes(${JSON.stringify(label)})).click()`,
    );
    await waitFor(
      `document.body.innerText.toLocaleLowerCase().includes(${JSON.stringify(expected.toLocaleLowerCase())})`,
    );
    await pause(350);
    const capture = await cdp('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    fs.writeFileSync(path.join(folder, file), Buffer.from(capture.data, 'base64'));
  }
  await evaluate(
    "Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes('Clientes e parcelas')).click()",
  );
  await waitFor("document.body.innerText.includes('Novo cliente')");
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Novo cliente')).click()",
  );
  await waitFor("!!document.querySelector('[role=dialog] input[name=name]')");
  await evaluate(
    "document.querySelector('input[name=name]').value='Cliente criado pela interface';document.querySelector('[role=dialog] form').requestSubmit()",
  );
  await waitFor("document.body.innerText.includes('Operação registrada')");
  await waitFor("!document.querySelector('[role=dialog]')");
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Nova parcela')).click()",
  );
  await waitFor("!!document.querySelector('[role=dialog] input[name=reference]')");
  await evaluate(
    "document.querySelector('input[name=reference]').value='Contrato UI';document.querySelector('input[name=amount]').value='123.45';document.querySelector('[role=dialog] form').requestSubmit()",
  );
  await waitFor(
    "!document.querySelector('[role=dialog]') && document.body.innerText.includes('Contrato UI')",
  );
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Confirmar pagamento')&&!b.disabled).click()",
  );
  await waitFor("!!document.querySelector('[role=dialog] input[name=paidDate]')");
  await evaluate(
    "document.querySelector('input[name=responsible]').value='Teste interface';document.querySelector('input[name=confirmed]').checked=true;document.querySelector('[role=dialog] form').requestSubmit()",
  );
  await waitFor("!document.querySelector('[role=dialog]')");
  assert.equal(
    await evaluate(
      "fetch('/api/operations').then(r=>r.json()).then(s=>s.installments.find(p=>p.reference==='Contrato UI').paidCents)",
    ),
    12345,
  );
  await evaluate(
    "Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes('Calendário Operacional')).click()",
  );
  await waitFor("document.body.innerText.includes('Exceção ou recesso')");
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Exceção ou recesso')).click()",
  );
  await waitFor("!!document.querySelector('[role=dialog] input[name=description]')");
  await evaluate(
    "document.querySelector('input[name=description]').value='Recesso UI';document.querySelector('[role=dialog] form').requestSubmit()",
  );
  await waitFor(
    "!document.querySelector('[role=dialog]') && document.body.innerText.includes('Recesso UI')",
  );
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp('Page.navigate', { url: base });
  await waitFor("document.body.innerText.includes('Fila operacional')");
  assert(
    await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),
    'Mobile central has horizontal overflow',
  );
  await pause(300);
  const mobile = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(folder, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
  assert.equal(exceptions.length, 0, exceptions.join('; '));
  console.log(
    'Browser passed: central, client history, calendar, client/installment/payment/calendar forms and mobile viewport; no runtime exceptions.',
  );
}
(async () => {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error(logs);
    try {
      if (logs.includes('Ready') && (await fetch(base)).ok) break;
    } catch {}
    if (i === 119) throw Error('Server startup timed out');
    await pause(250);
  }
  let s = await api();
  const today = s.today;
  assert.equal(s.clients.length, 0);
  assert(
    fs.readdirSync(folder).some((f) => f.startsWith('report-before-v2-')),
    'Migration backup missing',
  );
  s = await api({ type: 'import_legacy_clients' });
  const c = s.clients[0];
  assert.equal(s.activities.filter((a) => a.source === 'legacy').length, 1);
  s = await api({
    type: 'save_installment',
    clientId: c.id,
    reference: 'Contrato de teste',
    number: 1,
    amountCents: 10000,
    dueDate: shiftDate(today, -20),
  });
  const p = s.installments[0];
  assert(s.pending.some((t) => t.kind === 'initial' && t.status === 'open'));
  s = await api({
    type: 'save_calendar',
    date: shiftDate(today, 1),
    exceptionType: 'non_business',
    description: 'Recesso de teste',
  });
  const exception = s.exceptions[0];
  assert.equal(s.exceptions.length, 1);
  s = await api({
    type: 'save_calendar',
    id: exception.id,
    date: exception.date,
    exceptionType: 'business',
    description: 'Expediente excepcional',
  });
  assert.equal(s.exceptions[0].type, 'business');
  s = await api({ type: 'delete_calendar', id: exception.id });
  assert.equal(s.exceptions.length, 0);
  s = await api({
    type: 'service',
    clientId: c.id,
    serviceStatus: 'blocked',
    confirmed: true,
    responsible: 'Teste',
  });
  assert.equal(s.clients[0].serviceStatus, 'blocked');
  s = await api({
    type: 'schedule_payment',
    installmentId: p.id,
    scheduledDate: today,
    responsible: 'Teste',
  });
  assert(s.pending.some((t) => t.kind === 'scheduled_check' && t.status === 'open'));
  assert(!s.pending.some((t) => t.kind === 'initial' && t.status === 'open'));
  const partial = {
    type: 'confirm_payment',
    operationId: 'partial-once',
    installmentId: p.id,
    amountCents: 4000,
    paidDate: today,
    confirmed: true,
    responsible: 'Teste',
  };
  s = await api(partial);
  s = await api(partial);
  assert.equal(s.installments[0].paidCents, 4000);
  assert.equal(s.installments[0].status, 'partial');
  s = await api({ ...partial, operationId: 'settle-once', amountCents: 6000 });
  assert.equal(s.installments[0].status, 'paid');
  assert.equal(s.clients[0].serviceStatus, 'unblock_pending');
  s = await api({
    type: 'service',
    clientId: c.id,
    serviceStatus: 'active',
    confirmed: true,
    responsible: 'Teste',
  });
  assert.equal(s.clients[0].serviceStatus, 'active');
  const reports = await (await fetch(base + '/api/reports')).json();
  assert.equal(reports[0].body, 'Texto antigo preservado');
  const generated = await fetch(base + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: today }),
  });
  assert.equal(generated.status, 200);
  assert.equal(
    (await generated.json()).dailyActions,
    s.activities.filter((a) => a.date === today).length,
  );
  const denied = await fetch(base + '/api/operations', {
    method: 'POST',
    headers: { Origin: 'https://example.org', 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(denied.status, 403);
  console.log(
    'Production HTTP passed: migration/backup, legacy preservation, calendar CRUD, generated queue, scheduling, partial/complete payments, idempotency, service confirmation, reports and origin protection.',
  );
  if (process.argv.includes('--browser')) await browser();
  console.log('Isolated artifacts: ' + folder);
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (ws) ws.close();
    if (chrome) chrome.kill();
    server.kill();
  });
