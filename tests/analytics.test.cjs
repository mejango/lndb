const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(path = '/productos?ref=private-order') {
  const events = [], handlers = {};
  const location = new URL('https://www.losnombresdelbosque.com' + path);
  const document = {
    body: { dataset: {} },
    head: { appendChild() {} },
    createElement() { return {}; },
    querySelectorAll() { return []; },
    addEventListener(name, callback) { handlers[name] = callback; }
  };
  const window = { location, plausible: (name, options) => events.push({ name, ...options }) };
  const context = { window, document, location, URL, URLSearchParams };
  vm.runInNewContext(fs.readFileSync('js/analytics.js', 'utf8'), context);
  return { window, events, handlers, context };
}

test('custom events retain funnel context and exclude contact/order fields', () => {
  const { window, events } = setup();
  window.lndbTrack('Purchase Completed', { props: { quantity: 2, amount: 178000, currency: 'COP', name: 'private', email: 'private@example.com', reference: 'private', code: 'private', address: 'private' } });
  assert.deepEqual(JSON.parse(JSON.stringify(events[0])), { name: 'Purchase Completed', props: { page: '/productos', source: 'productos', quantity: 2, amount: 178000, currency: 'COP' } });
});

test('automatic tracker payload removes personalized URLs and retains campaign attribution', () => {
  const { window } = setup();
  const payload = window.plausible.o.transformRequest({ n: 'Outbound Link: Click', u: 'https://www.losnombresdelbosque.com/exito?ref=private&email=private&utm_source=newsletter#private', r: 'https://search.example/?q=private', p: { url: 'https://wa.me/573013784227?text=private-dedication', reference: 'private' } });
  assert.equal(payload.u, 'https://www.losnombresdelbosque.com/exito?utm_source=newsletter');
  assert.equal(payload.r, 'https://search.example/');
  assert.equal(payload.p.url, 'https://wa.me/573013784227');
  assert.equal(JSON.stringify(payload).includes('private'), false);
});

test('analytics failures cannot throw into a CTA or checkout handler', () => {
  const { window } = setup();
  window.plausible = () => { throw Error('tracker unavailable'); };
  assert.doesNotThrow(() => window.lndbTrack('Guide Download Click'));
});

test('guide CTAs emit distinct events once for click and middle-click, ignoring right-click', () => {
  const { events, handlers } = setup();
  const element = { dataset: { trackEvent: 'Guide Download Click', trackAction: 'download', trackAsset: 'mango-guide', trackPlacement: 'drawing_guide' }, closest() { return this; } };
  handlers.click({ type: 'click', target: element });
  handlers.auxclick({ type: 'auxclick', button: 1, target: element });
  handlers.auxclick({ type: 'auxclick', button: 2, target: element });
  assert.equal(events.length, 2);
  assert.equal(events[0].name, 'Guide Download Click');
  assert.equal(events[0].props.asset, 'mango-guide');
  element.dataset.trackEvent = 'Guide Print Click';
  handlers.click({ type: 'click', target: element });
  assert.equal(events[2].name, 'Guide Print Click');
});

test('local verification traffic is discarded before transmission', () => {
  const { window, context } = setup();
  context.location.hostname = 'localhost';
  assert.equal(window.plausible.o.transformRequest({ u: context.location.href }), null);
});

test('every page loads shared analytics before consumers, and inline scripts parse', () => {
  const files = fs.readdirSync('.').filter(f => f.endsWith('.html')).concat(fs.readdirSync('arboles').filter(f => f.endsWith('.html')).map(f => 'arboles/' + f));
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.indexOf('js/analytics.js') > 0, file);
    assert.ok(html.indexOf('js/analytics.js') < html.indexOf('js/components.js'), file);
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1], { filename: file });
  }
});
