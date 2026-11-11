const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createReceipt, purchaseHandler } = require('../lib/purchase-verification.cjs');

function storage() {
  const values = new Map();
  return { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
}
function browser(path = '/productos', options = {}) {
  const events = [], requests = [], timers = [];
  const location = new URL(path, 'https://www.losnombresdelbosque.com');
  const context = {
    location, URLSearchParams, sessionStorage: options.session || storage(), localStorage: options.local || storage(),
    setTimeout: fn => timers.push(fn),
    fetch: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => options.result || {} }; },
    fbq: (...args) => events.push(JSON.parse(JSON.stringify(args)))
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync('js/meta-events.js', 'utf8'), context);
  return { context, events, requests, timers };
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test('intent and completion events map to Meta without personal data or false purchases', () => {
  const { context, events } = browser();
  assert.equal(events[0][1], 'ViewContent');
  const props = { quantity: 2, group: 'quiz', email: 'private@example.com', name: 'Private', tree: 'Private quiz result', answer: 'Private' };
  for (const name of ['Checkout Opened', 'Email Signup', 'Newsletter Signup', 'Quiz Completed', 'Guide Download Click']) context.lndbMetaTrack(name, props);
  for (const name of ['Signup Submitted', 'Signup Error', 'Checkout Started', 'Purchase Completed', 'Checkout Payment Result']) context.lndbMetaTrack(name, props);
  assert.deepEqual(events.map(e => e[1]), ['ViewContent', 'InitiateCheckout', 'Lead', 'Lead', 'QuizCompleted', 'GuideDownload']);
  assert.equal(JSON.stringify(events).includes('Private'), false);
  assert.equal(JSON.stringify(events).includes('private@example.com'), false);
  assert.equal(events[1][2].num_items, 2);
  assert.equal(events[4][0], 'trackCustom');
});

test('local traffic, explicit test events, and missing/blocked pixel do not interrupt app', () => {
  const local = browser('http://localhost/productos');
  local.context.lndbMetaTrack('Email Signup');
  assert.equal(local.events.length, 0);
  const b = browser('/quiz');
  b.context.lndbMetaTrack('Checkout Opened', { type: 'test' });
  assert.equal(b.events.length, 0);
  b.context.fbq = () => { throw Error('blocked'); };
  assert.doesNotThrow(() => b.context.lndbMetaTrack('Email Signup'));
});

test('success URL alone never emits Purchase or makes a verification request', async () => {
  const b = browser('/exito?id=fake&ref=fake');
  await settled();
  assert.equal(b.requests.length, 0);
  assert.equal(b.events.length, 0);
});

test('server-verified purchase survives redirect and deduplicates on reload', async () => {
  const session = storage(), local = storage();
  const start = browser('/productos', { session, local });
  start.context.lndbRememberCheckout({ analyticsReceipt: 'signed-proof', reference: 'order' });
  start.context.lndbRememberTransaction('tx-1');
  const result = { verified: true, eventId: 'purchase-' + 'a'.repeat(64), value: 178000, currency: 'COP', quantity: 2 };
  const finish = browser('/exito?ref=order', { session, local, result });
  await settled();
  assert.deepEqual(finish.requests[0].body, { transactionId: 'tx-1', receipt: 'signed-proof' });
  assert.equal(finish.events[0][1], 'Purchase');
  assert.equal(finish.events[0][2].value, 178000);
  assert.equal(finish.events[0][3].eventID, result.eventId);
  const reload = browser('/exito?id=tx-1', { session, local, result });
  await settled();
  assert.equal(reload.events.length, 0);
});

test('pending payments retry; declined payments and test checkouts never convert', async () => {
  const session = storage();
  session.setItem('lndb-meta-checkout', JSON.stringify({ receipt: 'proof', transactionId: 'tx' }));
  const pending = browser('/exito', { session, result: { verified: false, pending: true } });
  await settled();
  assert.equal(pending.events.length, 0);
  assert.equal(pending.timers.length, 1);
  const declined = browser('/exito', { session, result: { verified: false, pending: false } });
  await settled();
  assert.equal(declined.events.length, 0);
  assert.equal(declined.timers.length, 0);
  declined.context.lndbRememberCheckout({ analyticsReceipt: null });
  assert.equal(session.getItem('lndb-meta-checkout'), null);
});

const secret = 'test-integrity-secret';
const order = { reference: 'LNDB-Q2-123-random', amountInCents: 17800000, currency: 'COP', quantity: 2 };
const tx = { id: 'tx-1', reference: order.reference, amount_in_cents: order.amountInCents, currency: 'COP', status: 'APPROVED' };
function server(overrides = {}) {
  const calls = [];
  const handler = purchaseHandler({
    env: { WOMPI_INTEGRITY_SECRET: secret, WOMPI_PRIVATE_KEY: 'prv_prod_dummy', ...overrides.env },
    fetchImpl: async (...args) => { calls.push(args); if (overrides.failure) throw Error('network'); return { ok: true, json: async () => ({ data: { ...tx, ...overrides.tx } }) }; }
  });
  return { calls, async request(body = {}) {
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ body: { transactionId: 'tx-1', receipt: createReceipt(order, secret), ...body } }, res);
    return res;
  } };
}

test('server returns only approved payment metadata with value converted from cents', async () => {
  const s = server(), result = await s.request();
  assert.equal(result.code, 200);
  assert.equal(result.data.value, 178000);
  assert.equal(result.data.verified, true);
  assert.match(result.data.eventId, /^purchase-[a-f0-9]{64}$/);
  assert.equal(s.calls[0][0], 'https://production.wompi.co/v1/transactions/tx-1');
  assert.equal(s.calls[0][1].headers.Authorization, 'Bearer prv_prod_dummy');
  assert.deepEqual(Object.keys(result.data).sort(), ['currency', 'eventId', 'quantity', 'value', 'verified']);
});

test('tampered proof, test proof, missing credentials and malformed IDs fail closed', async () => {
  const s = server();
  assert.equal((await s.request({ receipt: createReceipt(order, 'sandbox-secret') })).code, 400);
  assert.equal((await s.request({ receipt: 'tampered' })).code, 400);
  assert.equal((await s.request({ transactionId: '../../private' })).code, 400);
  assert.equal(s.calls.length, 0);
  assert.equal((await server({env:{ WOMPI_PRIVATE_KEY: '' }}).request()).code, 503);
  assert.equal((await server({env:{ WOMPI_PRIVATE_KEY: 'prv_test_dummy' }}).request()).code, 503);
});

test('mismatched amount, currency, reference, or transaction ID never yields purchase', async () => {
  for (const mismatch of [{ amount_in_cents: 1 }, { currency: 'USD' }, { reference: 'other' }, { id: 'other' }]) {
    const result = await server({ tx: mismatch }).request();
    assert.equal(result.code, 400);
    assert.equal(result.data.verified, undefined);
  }
});

test('unapproved statuses and verification failures never yield purchase', async () => {
  for (const status of ['PENDING', 'DECLINED', 'VOIDED', 'ERROR']) {
    const result = await server({tx:{status}}).request();
    assert.equal(result.data.verified, false);
    assert.equal(result.data.pending, status === 'PENDING');
  }
  assert.equal((await server({failure:true}).request()).code, 502);
});
