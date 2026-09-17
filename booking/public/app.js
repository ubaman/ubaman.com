import {dateKey, groupSlots, monthGrid, shiftMonth, reconcileSelection, toggleSelection} from './calendar-model.js?v=20260917';

const $ = id => document.getElementById(id);
const form = $('booking');
let config, available = [], selected = new Set(), groups = new Map();
let zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let month = dateKey(Date.now() / 1000, zone).slice(0, 7), activeDay = '';
let clock = 12, challenge = '', widget, busy = false, loading = true, loadError = false;
const quantity = () => Number(form.elements.quantity.value);
const money = cents => new Intl.NumberFormat('es-MX', {maximumFractionDigits: 2}).format(cents / 100);
const dateLabel = (key, options = {weekday: 'long', day: 'numeric', month: 'long'}) => new Intl.DateTimeFormat('es-MX', {...options, timeZone: 'UTC'}).format(new Date(`${key}T12:00:00Z`));
const timeLabel = start => new Intl.DateTimeFormat('es-MX', {timeZone: zone, hour: 'numeric', minute: '2-digit', hourCycle: clock === 24 ? 'h23' : 'h12'}).format(new Date(start * 1000));
const fullLabel = start => `${dateLabel(dateKey(start, zone))}, ${timeLabel(start)}`;
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function notice(message, kind = '') { $('notice').textContent = message; $('notice').dataset.kind = kind; }
function announce(message) { $('selection-announcement').textContent = message; }
async function api(path, body) {
  const response = await fetch(`/api/${path}`, body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {cache: 'no-store', signal: AbortSignal.timeout(15000)});
  let data;
  try { data = await response.json(); } catch { throw new Error('No pudimos leer la respuesta. Inténtalo nuevamente.'); }
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar. Inténtalo nuevamente.');
  return data;
}
function updateGroups(preferredDay = activeDay) {
  groups = groupSlots(available, zone);
  activeDay = groups.has(preferredDay) ? preferredDay : groups.keys().next().value || '';
  if (activeDay) month = activeDay.slice(0, 7);
}
function renderCalendar() {
  $('month-title').textContent = dateLabel(`${month}-01`, {month: 'long', year: 'numeric'});
  const days = [...groups.keys()], first = days[0]?.slice(0, 7), last = days.at(-1)?.slice(0, 7);
  $('prev-month').disabled = busy || loading || !first || month <= first;
  $('next-month').disabled = busy || loading || !last || month >= last;
  const today = dateKey(Date.now() / 1000, zone);
  const chosenDays = new Set([...selected].map(start => dateKey(start, zone)));
  const fragment = document.createDocumentFragment();
  for (const day of monthGrid(month)) {
    if (!day) { fragment.append(element('span', 'date-blank')); continue; }
    const button = element('button', `date-button${chosenDays.has(day) ? ' has-selection' : ''}`, Number(day.slice(-2)));
    button.type = 'button'; button.dataset.day = day;
    const count = groups.get(day)?.length || 0;
    button.disabled = loading || loadError || busy || !count;
    button.setAttribute('aria-pressed', String(activeDay === day));
    button.setAttribute('aria-label', `${dateLabel(day)}. ${count ? `${count} horarios disponibles` : 'Sin horarios disponibles'}${chosenDays.has(day) ? '. Con sesión elegida' : ''}`);
    if (day === today) button.setAttribute('aria-current', 'date');
    fragment.append(button);
  }
  $('calendar-days').replaceChildren(fragment);
  $('multi-hint').textContent = quantity() === 1 ? 'Elige un horario. Si cambias de idea, selecciona otro para reemplazarlo.' : `Puedes repartir tus ${quantity()} sesiones en días distintos. Tu selección se conserva al cambiar de día.`;
}
function renderTimes() {
  $('day-title').textContent = loading ? 'Cargando horarios…' : activeDay ? dateLabel(activeDay, {weekday: 'short', day: 'numeric', month: 'short'}) : 'Sin horarios disponibles';
  const slots = groups.get(activeDay) || [];
  $('time-help').textContent = 'Cada horario es una sesión de 60 min.';
  const fragment = document.createDocumentFragment();
  if (loading || loadError || !slots.length) {
    fragment.append(element('p', 'empty-slots', loading ? 'Cargando disponibilidad…' : loadError ? 'No pudimos consultar los horarios. Pulsa «Actualizar» para volver a intentarlo.' : 'No hay horarios disponibles por ahora. Puedes volver a consultar más tarde.'));
  } else for (const start of slots) {
    const chosen = selected.has(start), button = element('button', 'time-button');
    button.type = 'button'; button.dataset.start = start;
    button.disabled = busy || (!chosen && quantity() > 1 && selected.size >= quantity());
    button.setAttribute('aria-pressed', String(chosen));
    button.setAttribute('aria-label', `${fullLabel(start)}${chosen ? ', seleccionada; quitar sesión' : ', seleccionar sesión'}`);
    const mark = element('span', 'time-mark', '✓'); mark.setAttribute('aria-hidden', 'true');
    button.append(element('span', '', timeLabel(start)), mark); fragment.append(button);
  }
  $('slots').replaceChildren(fragment);
  $('slots-hint').textContent = selected.size === quantity() ? 'Tu plan está completo. Puedes quitar una sesión para cambiarla.' : 'Los horarios se confirman después del pago.';
  document.querySelectorAll('[data-clock]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.clock) === clock)));
}
function renderSummary() {
  const q = quantity(), amount = config?.packages[q];
  $('count').textContent = `${selected.size} de ${q} ${q === 1 ? 'sesión' : 'sesiones'}`;
  $('selection-progress').replaceChildren(...Array.from({length: q}, (_, index) => element('span', index < selected.size ? 'filled' : '')));
  const fragment = document.createDocumentFragment();
  [...selected].sort((a, b) => a - b).forEach((start, index) => {
    const row = element('li', 'session-row'), label = element('div', 'session-label');
    label.append(element('strong', '', dateLabel(dateKey(start, zone), {weekday: 'short', day: 'numeric', month: 'short'})), element('span', '', `${timeLabel(start)} – ${timeLabel(start + 3600)} · 60 min`));
    const remove = element('button', 'remove-session', '×'); remove.type = 'button'; remove.dataset.remove = start;
    remove.disabled = busy || loading; remove.setAttribute('aria-label', `Quitar sesión del ${fullLabel(start)}`);
    row.append(element('span', 'session-index', String(index + 1).padStart(2, '0')), label, remove); fragment.append(row);
  });
  if (!selected.size) fragment.append(element('li', 'selection-empty', 'Tu próxima mejora empieza aquí. Selecciona un día en el calendario y añade tu primer horario.'));
  $('selected').replaceChildren(fragment);
  if (amount) {
    $('total').replaceChildren(document.createTextNode(`$${money(amount)} `), element('small', '', 'USD'));
    const saving = Math.round((1 - amount / (config.packages[1] * q)) * 100);
    $('saving').textContent = saving > 0 ? `${saving}% de descuento · $${money(amount / q)} USD por sesión.` : 'Pago único. Sin suscripción.';
  }
  updatePay();
}
function updatePay() {
  const remaining = quantity() - selected.size;
  $('pay').disabled = !config?.enabled || busy || loading || loadError || remaining !== 0 || !challenge;
  $('pay').replaceChildren(document.createTextNode(busy ? 'Preparando tu pago…' : 'Continuar al pago '), element('span', '', busy ? '…' : '↗'));
  $('pay-hint').textContent = !config ? 'Cargando configuración…' : !config.enabled ? 'Las reservas no están activas por el momento.' : loadError ? 'Actualiza los horarios para continuar.' : busy ? 'Comprobando disponibilidad antes de ir a Stripe.' : remaining ? `Elige ${remaining} ${remaining === 1 ? 'horario más' : 'horarios más'} para continuar.` : !challenge ? 'Completa la verificación de seguridad para continuar.' : 'Completa tus datos. El pago se realiza en Stripe.';
}
function render() {
  // Re-render small collections, restoring keyboard focus when a control survives.
  const focused = document.activeElement;
  const focusKey = focused?.dataset.day ? ['day', focused.dataset.day] : focused?.dataset.start ? ['start', focused.dataset.start] : focused?.dataset.remove ? ['remove', focused.dataset.remove] : null;
  renderCalendar(); renderTimes(); renderSummary();
  $('calendar-shell').setAttribute('aria-busy', String(loading)); $('slots').setAttribute('aria-busy', String(loading));
  $('packages').disabled = !config || busy || loading;
  $('timezone').disabled = !config || busy || loading;
  $('refresh').disabled = busy || loading;
  if (focusKey) {
    const replacement = document.querySelector(`[data-${focusKey[0]}="${focusKey[1]}"]`);
    if (replacement && !replacement.disabled) replacement.focus({preventScroll: true});
    else if (focusKey[0] === 'remove') $('calendar-days').querySelector('button:not(:disabled)')?.focus({preventScroll: true});
  }
}
function setupZones() {
  const choices = new Map([[zone, `${zone.replaceAll('_', ' ')} · tu zona`], [config.zone, `${config.zone.replaceAll('_', ' ')} · Ubaman`]]);
  for (const [value, label] of [['America/Mexico_City', 'Ciudad de México'], ['America/Tijuana', 'Tijuana'], ['America/Bogota', 'Bogotá / Lima'], ['America/Argentina/Buenos_Aires', 'Buenos Aires'], ['America/Santiago', 'Santiago'], ['America/New_York', 'Nueva York'], ['America/Los_Angeles', 'Los Ángeles'], ['Europe/Madrid', 'Madrid'], ['UTC', 'UTC']]) if (!choices.has(value)) choices.set(value, label);
  $('timezone').replaceChildren(...[...choices].map(([value, label]) => { const option = element('option', '', label); option.value = value; return option; }));
  $('timezone').value = zone;
}
function setupPrices() {
  for (const q of [1, 3, 5]) {
    const amount = config.packages[q]; $('price-' + q).textContent = `$${money(amount)}`;
    if (q === 1) continue;
    const discount = Math.round((1 - amount / (config.packages[1] * q)) * 100);
    $('discount-' + q).textContent = `−${Math.max(0, discount)}%`; $('discount-' + q).hidden = discount <= 0;
    $('detail-' + q).textContent = `$${money(amount / q)} USD por sesión · Total del paquete`;
  }
}
async function refresh() {
  loading = true; notice('Actualizando los horarios disponibles…'); render();
  try {
    const data = await api('slots');
    if (!Array.isArray(data.slots)) throw new Error('No se pudo leer la disponibilidad. Pulsa «Actualizar».');
    const previousCount = selected.size;
    available = data.slots.filter(slot => Number.isSafeInteger(slot.start) && slot.start > Date.now() / 1000);
    selected = reconcileSelection(selected, available, quantity()); updateGroups(); loadError = false;
    notice(!config.enabled ? 'Las reservas están pausadas por el momento.' : previousCount > selected.size ? 'Un horario elegido dejó de estar disponible. Selecciona otro para completar tu plan.' : available.length ? 'Horarios en tu zona horaria. Elige las fechas y continúa al pago.' : 'No hay horarios disponibles por ahora. Vuelve a consultar más tarde.');
  } catch (error) { loadError = true; notice(error.name === 'TimeoutError' ? 'La consulta tardó demasiado. Pulsa «Actualizar» para intentarlo de nuevo.' : error.message, 'error'); }
  finally { loading = false; render(); }
}
function loadVerification() {
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => {
    widget = window.turnstile.render('#challenge', {
      sitekey: config.siteKey, action: 'booking', theme: 'dark', size: 'flexible',
      callback: token => { challenge = token; $('verification-note').textContent = ''; updatePay(); },
      'expired-callback': () => { challenge = ''; $('verification-note').textContent = 'La verificación caducó. Complétala nuevamente para continuar.'; updatePay(); },
      'error-callback': () => { challenge = ''; $('verification-note').textContent = 'No se pudo verificar la conexión. Si no se reintenta automáticamente, recarga la página.'; updatePay(); }
    });
  };
  script.onerror = () => { $('verification-note').textContent = 'No se pudo cargar la verificación de seguridad. Revisa tu conexión y recarga la página.'; updatePay(); };
  document.head.append(script);
}
$('calendar-days').addEventListener('click', event => {
  const button = event.target.closest('[data-day]'); if (!button || button.disabled) return;
  activeDay = button.dataset.day; render();
  announce(`${dateLabel(activeDay)}. ${groups.get(activeDay).length} horarios disponibles.`);
});
$('calendar-days').addEventListener('keydown', event => {
  const button = event.target.closest('[data-day]');
  if (!button || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...$('calendar-days').querySelectorAll('button')], index = buttons.indexOf(button);
  const step = {ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7}[event.key];
  for (let next = index + step; next >= 0 && next < buttons.length; next += step) if (!buttons[next].disabled) { buttons[next].focus(); break; }
});
$('slots').addEventListener('click', event => {
  const button = event.target.closest('[data-start]'); if (!button || button.disabled) return;
  selected = toggleSelection(selected, Number(button.dataset.start), quantity()); render();
  announce(`${selected.size} de ${quantity()} sesiones seleccionadas.`);
});
$('selected').addEventListener('click', event => {
  const button = event.target.closest('[data-remove]'); if (!button || button.disabled) return;
  selected.delete(Number(button.dataset.remove)); render(); announce(`Sesión eliminada. ${selected.size} de ${quantity()} seleccionadas.`);
});
form.querySelectorAll('[name=quantity]').forEach(radio => radio.addEventListener('change', () => {
  const previousCount = selected.size;
  selected = reconcileSelection(selected, available, quantity()); render();
  announce(previousCount > selected.size ? `Plan cambiado. Conservamos tus primeras ${quantity()} selecciones.` : `Plan de ${quantity()} sesiones. ${selected.size} seleccionadas.`);
}));
$('timezone').addEventListener('change', () => {
  const anchor = groups.get(activeDay)?.[0]; zone = $('timezone').value;
  updateGroups(anchor ? dateKey(anchor, zone) : ''); render(); announce('Zona horaria actualizada. Tus sesiones se conservan.');
});
document.querySelectorAll('[data-clock]').forEach(button => button.addEventListener('click', () => { clock = Number(button.dataset.clock); render(); }));
for (const [id, delta] of [['prev-month', -1], ['next-month', 1]]) $(id).addEventListener('click', () => {
  month = shiftMonth(month, delta); activeDay = [...groups.keys()].find(day => day.startsWith(month)) || ''; render();
});
$('refresh').addEventListener('click', () => config ? refresh() : init());
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || loading || loadError || !config?.enabled || selected.size !== quantity() || !challenge || !form.reportValidity()) return;
  busy = true; render(); notice('Comprobando tus horarios antes de continuar a Stripe…');
  try {
    const data = await api('book', {quantity: quantity(), slots: [...selected], name: form.elements.name.value, email: form.elements.email.value, challenge});
    if (!data.url && !data.token) throw new Error('No se recibió el enlace de pago. Inténtalo nuevamente.');
    location.assign(data.url || `/resultado.html#${data.token}`);
  } catch (error) {
    busy = false; challenge = '';
    if (widget !== undefined && window.turnstile) window.turnstile.reset(widget);
    await refresh(); notice(error.message, 'error'); render();
  }
});
async function init() {
  loading = true; render();
  try {
    const data = await api('config');
    if (![1, 3, 5].every(q => Number.isFinite(data.packages?.[q]) && data.packages[q] > 0) || !data.zone) throw new Error('Configuración incompleta. Inténtalo más tarde.');
    config = data; setupZones(); setupPrices(); await refresh();
    if (config.enabled) loadVerification();
  } catch (error) { loading = false; loadError = true; notice('No pudimos cargar el calendario. Pulsa «Actualizar» para volver a intentarlo.', 'error'); render(); }
}
init();
