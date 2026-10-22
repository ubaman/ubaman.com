// Calendario de Wild Rift: lee eventos.json y dibuja una línea de tiempo con los días arriba
// y cada evento como una barra (imagen + texto) que ocupa sus días exactos.
const DAY = 86400000;
const groupsEl = document.getElementById('groups');
const shortDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const monthName = new Intl.DateTimeFormat('es-MX', { month: 'long' });
const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });

const parse = (value) => {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const today = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
const clean = (text) => text.replace('.', '');

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function label(date, rangeYear) {
  const text = clean(shortDate.format(date));
  return date.getFullYear() === rangeYear ? text : `${text} ${date.getFullYear()}`;
}

function dateText(start, end, rangeYear) {
  if (start && end) return start.getTime() === end.getTime() ? label(start, rangeYear) : `${label(start, rangeYear)} – ${label(end, rangeYear)}`;
  if (start) return `Desde el ${label(start, rangeYear)}`;
  return `Hasta el ${label(end, rangeYear)}`;
}

function status(start, end) {
  if (start && today < start) {
    const n = daysBetween(today, start);
    return { state: 'soon', text: n === 1 ? 'Mañana' : `En ${n} días` };
  }
  if (end && today > end) return { state: 'ended', text: 'Terminado' };
  if (!end) return { state: 'live', text: 'Disponible' };
  const left = daysBetween(today, end);
  return { state: 'live', text: left === 0 ? 'Último día' : `Quedan ${left} ${left === 1 ? 'día' : 'días'}` };
}

function thumb(event) {
  const box = el('span', 'thumb');
  if (event.imagen) {
    const img = el('img');
    img.src = event.imagen;
    img.alt = '';
    img.loading = 'lazy';
    box.append(img);
  } else {
    box.classList.add('thumb-empty');
    box.append(el('span', '', event.nombre.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').slice(0, 1).toUpperCase()));
  }
  return box;
}

function render(data) {
  const range = { start: parse(data.rango.inicio), end: parse(data.rango.fin) };
  // Solo se muestra desde 2 días antes de hoy: lo anterior ya no interesa.
  const earliest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
  if (earliest > range.start) range.start = earliest;
  const total = daysBetween(range.start, range.end) + 1;
  const rangeYear = range.start.getFullYear();
  const todayIndex = today >= range.start && today <= range.end ? daysBetween(range.start, today) : null;
  const dayAt = (i) => new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() + i);

  // Todo ordenado por fecha de inicio (lo ya disponible primero) y luego por fin.
  const startKey = (e) => (e.inicio ? parse(e.inicio) : range.start).getTime();
  const endKey = (e) => (e.fin ? parse(e.fin) : range.end).getTime();
  const eventos = data.eventos
    .filter((e) => !e.fin || parse(e.fin) >= range.start)
    .sort((a, b) => startKey(a) - startKey(b) || endKey(a) - endKey(b));

  const board = el('section', 'board');
  board.setAttribute('aria-label', 'Calendario de eventos');

  const controls = el('div', 'controls');
  const prev = el('button', 'nav-btn', '‹ Semana anterior');
  const now = el('button', 'nav-btn nav-today', 'Hoy');
  const next = el('button', 'nav-btn', 'Semana siguiente ›');
  [prev, now, next].forEach((b) => { b.type = 'button'; });
  controls.append(prev, now, next);

  const scroller = el('div', 'timeline');
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', 'Línea de tiempo; desplázate horizontalmente para ver más días');
  const inner = el('div', 'tl-inner');
  inner.style.setProperty('--days', total);

  // Cabecera: meses y días (día de la semana + número), como un calendario de juego.
  const months = el('div', 'tl-months');
  const days = el('div', 'tl-days');
  for (let i = 0; i < total; i++) {
    const d = dayAt(i);
    if (i === 0 || d.getDate() === 1) {
      const next1 = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const span = Math.min(total - i, daysBetween(d, next1));
      const m = el('span', 'tl-month');
      m.append(el('span', '', monthName.format(d)));
      m.style.gridColumn = `${i + 1} / span ${span}`;
      months.append(m);
    }
    const cell = el('button', 'tl-day');
    cell.type = 'button';
    cell.dataset.index = i;
    cell.setAttribute('aria-pressed', 'false');
    if (i === todayIndex) cell.classList.add('is-today');
    if (d.getDay() === 0 || d.getDay() === 6) cell.classList.add('is-weekend');
    cell.append(el('small', '', clean(weekday.format(d))), el('b', '', String(d.getDate())));
    cell.setAttribute('aria-label', `${i === todayIndex ? 'Hoy, ' : ''}${clean(weekday.format(d))} ${d.getDate()} de ${monthName.format(d)}: marcar columna`);
    days.append(cell);
  }

  const rows = el('ol', 'tl-rows');
  if (todayIndex !== null) {
    const col = el('span', 'tl-today');
    col.style.gridColumn = `${todayIndex + 1}`;
    col.setAttribute('aria-hidden', 'true');
    rows.append(col);
  }
  // Columna guía: al pulsar un día se marca hacia abajo para ver qué eventos coinciden.
  const pick = el('span', 'tl-pick');
  pick.setAttribute('aria-hidden', 'true');
  pick.hidden = true;
  rows.append(pick);
  let picked = null;
  days.addEventListener('click', (event) => {
    const cell = event.target.closest('.tl-day');
    if (!cell) return;
    const i = Number(cell.dataset.index);
    if (picked) { picked.classList.remove('is-picked'); picked.setAttribute('aria-pressed', 'false'); }
    if (picked === cell) { picked = null; pick.hidden = true; return; }
    picked = cell;
    cell.classList.add('is-picked');
    cell.setAttribute('aria-pressed', 'true');
    pick.style.gridColumn = `${i + 1}`;
    pick.hidden = false;
  });
  eventos.forEach((event, r) => {
    const start = parse(event.inicio);
    const end = parse(event.fin);
    const from = start ? Math.max(0, daysBetween(range.start, start)) : 0;
    const to = end ? Math.min(total, daysBetween(range.start, end) + 1) : total;
    if (to <= 0 || from >= total) return;
    const st = status(start, end);

    const row = el('li', `tl-row state-${st.state}`);
    row.style.gridRow = `${r + 1}`;
    row.style.gridColumn = `${from + 1} / ${to + 1}`;
    const bar = el('div', 'bar');
    if (!start || start < range.start) bar.classList.add('open-start');
    if (!end || end > range.end) bar.classList.add('open-end');

    // El contenido es "sticky" para que el texto siga visible al desplazar la línea de tiempo.
    const content = el('div', 'bar-content');
    const text = el('div', 'bar-text');
    const title = el('strong', '', event.nombre);
    const meta = el('span', 'bar-meta');
    if (event.etiqueta) meta.append(el('span', 'tag', event.etiqueta));
    meta.append(el('span', 'dates', dateText(start, end, rangeYear)), el('span', 'status', st.text));
    text.append(title, meta);
    content.append(thumb(event), text);
    bar.append(content);
    row.append(bar);
    rows.append(row);
  });
  rows.style.setProperty('--rows', eventos.length);

  inner.append(months, days, rows);
  scroller.append(inner);
  board.append(controls, scroller);
  groupsEl.replaceChildren(board);

  const dayWidth = () => days.firstElementChild.getBoundingClientRect().width;
  const scrollToDay = (i, behavior = 'smooth') => scroller.scrollTo({ left: Math.max(0, (i - 2) * dayWidth()), behavior });
  prev.addEventListener('click', () => scroller.scrollBy({ left: -7 * dayWidth(), behavior: 'smooth' }));
  next.addEventListener('click', () => scroller.scrollBy({ left: 7 * dayWidth(), behavior: 'smooth' }));
  now.addEventListener('click', () => scrollToDay(todayIndex ?? 0));
  now.hidden = todayIndex === null;
  scrollToDay(todayIndex ?? 0, 'auto');
}

fetch('/calendario/eventos.json', { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(render)
  .catch(() => { groupsEl.replaceChildren(el('p', 'loading', 'No se pudo cargar el calendario. Recarga la página.')); });
