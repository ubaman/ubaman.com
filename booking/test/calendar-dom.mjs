// Optional DOM integration test. Install jsdom outside the app and set JSDOM_PATH.
// Example: JSDOM_PATH=/tmp/qa/node_modules/jsdom/lib/api.js node test/calendar-dom.mjs
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as model from '../public/calendar-model.js';
const {JSDOM} = await import(process.env.JSDOM_PATH || 'jsdom');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');
const base = Math.floor(Date.UTC(new Date().getUTCFullYear() + 1, 0, 28, 16) / 1000);
const slots = Array.from({length: 40}, (_, n) => ({start: base + Math.floor(n / 5) * 86400 + (n % 5) * 5400}));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function setup(mode = 'normal') {
  const dom = new JSDOM(html, {url: 'https://booking.test/', runScripts: 'outside-only', pretendToBeVisual: true});
  const window = dom.window;
  let data = slots, failure = mode === 'error', payload, verification;
  Object.assign(window, model, {AbortSignal});
  window.fetch = async (path, options) => {
    if (path === '/api/config') return {ok: true, json: async () => ({enabled: mode !== 'disabled', zone: 'America/Hermosillo', packages: {1: 4000, 3: 9600, 5: 16000}, siteKey: 'SIMULATED'})};
    if (path === '/api/book') {payload = JSON.parse(options.body); return {ok: false, json: async () => ({error: 'SIMULATED_CONFLICT'})};}
    return {ok: !failure, json: async () => failure ? {error: 'SIMULATED_ERROR'} : {slots: mode === 'empty' ? [] : data}};
  };
  window.turnstile = {render: (_target, settings) => {verification = settings; return 'mock';}, reset: () => {}};
  vm.runInContext(app, dom.getInternalVMContext());
  await tick();
  const script = window.document.querySelector('script[src*="challenges.cloudflare.com"]');
  if (script) script.dispatchEvent(new window.Event('load'));
  const query = selector => window.document.querySelector(selector);
  const click = selector => {const node = query(selector); assert.ok(node, selector); assert.equal(node.disabled, false, selector); node.click();};
  const plan = quantity => {const input = query(`[name=quantity][value="${quantity}"]`); input.checked = true; input.dispatchEvent(new window.Event('change', {bubbles: true}));};
  return {window, query, click, plan, close: () => window.close(), verify: () => verification.callback('MOCK_CHALLENGE'), expire: () => verification['expired-callback'](), setSlots: value => {data = value;}, recover: () => {failure = false;}, payload: () => payload};
}
const test = await setup();
test.click('[data-start]');
assert.equal(test.query('#count').textContent, '1 de 1 sesión');
assert.equal(test.query('#pay').disabled, true);
test.plan(3);
assert.equal(test.query('#count').textContent, '1 de 3 sesiones');
const days = [...test.window.document.querySelectorAll('[data-day]:not(:disabled)')];
test.click(`[data-day="${days[1].dataset.day}"]`);
test.click('[data-start]');
test.click('#next-month');
test.click('[data-start]');
assert.equal(test.query('#count').textContent, '3 de 3 sesiones');
assert.equal(test.query('#total').textContent, '$96 USD');
const selectedBefore = [...test.window.document.querySelectorAll('[data-remove]')].map(node => node.dataset.remove);
test.click('[data-clock="24"]');
test.query('#timezone').value = 'Europe/Madrid';
test.query('#timezone').dispatchEvent(new test.window.Event('change'));
assert.deepEqual([...test.window.document.querySelectorAll('[data-remove]')].map(node => node.dataset.remove), selectedBefore);
test.verify();
assert.equal(test.query('#pay').disabled, false);
test.expire();
assert.equal(test.query('#pay').disabled, true);
test.verify();
test.query('[name=name]').value = 'Cliente de prueba';
test.query('[name=email]').value = 'test@example.com';
test.click('#pay');
await tick();
assert.deepEqual(Object.keys(test.payload()).sort(), ['challenge', 'email', 'name', 'quantity', 'slots']);
assert.equal(test.payload().quantity, 3);
assert.deepEqual(test.payload().slots.slice().sort((a,b)=>a-b), selectedBefore.map(Number).sort((a,b)=>a-b));
assert.equal(test.payload().challenge, 'MOCK_CHALLENGE');
assert.match(test.query('#notice').textContent, /SIMULATED_CONFLICT/);
assert.equal(test.query('[name=email]').value, 'test@example.com');
assert.equal(test.query('#pay').disabled, true);
test.setSlots(slots.slice(1));
test.click('#refresh'); await tick();
assert.equal(test.query('#count').textContent, '2 de 3 sesiones');
assert.match(test.query('#notice').textContent, /dejó de estar disponible/);
test.plan(1); assert.equal(test.query('#count').textContent, '1 de 1 sesión');
test.click('[data-remove]'); assert.equal(test.query('#count').textContent, '0 de 1 sesión');
test.close();
for (const scenario of ['empty', 'error', 'disabled']) {
  const test = await setup(scenario);
  assert.equal(test.query('#pay').disabled, true);
  assert.equal(test.query('#refresh').disabled, false);
  if (scenario === 'empty') assert.match(test.query('#slots').textContent, /No hay horarios/);
  if (scenario === 'error') {
    assert.match(test.query('#notice').textContent, /SIMULATED_ERROR/);
    test.recover(); test.click('#refresh'); await tick();
    assert.ok(test.query('[data-start]'));
  }
  test.close();
}
console.log('PASS: DOM selection, packages, month navigation, time zone, 12/24h, verification expiry, checkout contract, conflict recovery, refresh, empty, error and disabled states. No real network calls.');
