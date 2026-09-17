// LOCAL QA ONLY. No production APIs, credentials, reservations or payments.
// Run: node test/preview-server.mjs, then visit http://localhost:4173/__qa
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
const publicRoot = resolve(import.meta.dirname, '../public');
let scenario = 'normal', lastBooking = null, dropFirst = false;
const fixture = [];
const base = new Date();
base.setUTCDate(28); base.setUTCHours(16, 0, 0, 0);
if (base < new Date()) base.setUTCMonth(base.getUTCMonth() + 1);
for (let day = 0; day < 8; day++) for (let slot = 0; slot < 5; slot++) {
  const start = base.getTime() / 1000 + day * 86400 + slot * 5400;
  fixture.push({start, day: new Date(start * 1000).toISOString().slice(0, 10)});
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost:4173');
  const send = (body, type = 'application/json', status = 200) => {response.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'}); response.end(typeof body === 'string' ? body : JSON.stringify(body));};
  if (url.pathname === '/__qa') return send(`<!doctype html><html><head><title>Booking QA — simulation only</title><style>body{margin:0;background:#35383e;font:14px system-ui;color:white}header{padding:12px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}button,select{padding:8px}iframe{display:block;border:0;margin:0 auto;width:1280px;height:1900px;max-width:100%}pre{white-space:pre-wrap;margin:12px}</style></head><body><header><b>LOCAL QA / NO REAL PAYMENTS</b><label>Preview width <select id="width"><option>1280</option><option>768</option><option>600</option><option>390</option><option>320</option></select></label><button data-case="normal">Normal</button><button data-case="empty">No availability</button><button data-case="error">API error</button><button data-case="disabled">Booking disabled</button><button data-case="remove">Remove first slot</button><button id="inspect">Inspect mock submission</button></header><pre id="report">All data is simulated.</pre><iframe id="preview" title="Booking preview" src="/"></iframe><script>const frame=document.getElementById('preview');document.getElementById('width').onchange=e=>frame.style.width=e.target.value+'px';document.querySelectorAll('[data-case]').forEach(b=>b.onclick=async()=>{await fetch('/__scenario?case='+b.dataset.case);if(b.dataset.case!=='remove')frame.src='/';});document.getElementById('inspect').onclick=async()=>{document.getElementById('report').textContent=JSON.stringify(await(await fetch('/__last-booking')).json(),null,2);};</script></body></html>`, 'text/html');
  if (url.pathname === '/__scenario') { const next = url.searchParams.get('case'); if (next === 'remove') dropFirst = true; else {scenario = next; dropFirst = false;} return send({scenario}); }
  if (url.pathname === '/__last-booking') return send(lastBooking);
  if (url.pathname === '/api/config') return send({enabled: scenario !== 'disabled', packages: {1: 4000, 3: 9600, 5: 16000}, zone: 'America/Hermosillo', siteKey: 'LOCAL_QA_ONLY'});
  if (url.pathname === '/api/slots') return scenario === 'error' ? send({error: 'Error simulado de disponibilidad.'}, 'application/json', 503) : send({slots: scenario === 'empty' ? [] : dropFirst ? fixture.slice(1) : fixture});
  if (url.pathname === '/api/book' && request.method === 'POST') {
    let body = ''; for await (const chunk of request) body += chunk;
    lastBooking = JSON.parse(body);
    return send({error: 'PRUEBA LOCAL: solicitud recibida. No se ha creado ninguna reserva ni cobro.'}, 'application/json', 409);
  }
  if (url.pathname === '/__turnstile.js') return send(`window.turnstile={render(selector,options){const b=document.createElement('button');b.type='button';b.textContent='Completar verificación simulada';b.onclick=()=>{options.callback('LOCAL_QA_TOKEN');b.textContent='Verificación simulada completa';};document.querySelector(selector).replaceChildren(b);return 'mock-widget';},reset(){document.querySelector('#challenge button').textContent='Completar verificación simulada';}};`, 'text/javascript');
  const path = resolve(publicRoot, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!path.startsWith(publicRoot + '/')) return send('Not found', 'text/plain', 404);
  try {
    let content = await readFile(path, 'utf8');
    if (url.pathname === '/app.js') content = content.replace('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', '/__turnstile.js');
    send(content, {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'}[extname(path)] || 'text/plain');
  } catch { send('Not found', 'text/plain', 404); }
});
server.listen(4173, '0.0.0.0', () => console.log('Local QA: http://localhost:4173/__qa — simulated data only'));
