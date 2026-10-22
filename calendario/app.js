// Calendario de Wild Rift: lee eventos.json y dibuja cada evento como una barra en su rango de fechas.
const DAY = 86400000;
const groupsEl = document.getElementById('groups');
const shortDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const monthName = new Intl.DateTimeFormat('es-MX', { month: 'long' });

const parse = (value) => {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const today = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function label(date, rangeYear) {
  const text = shortDate.format(date).replace('.', '');
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
  return { state: 'live', text: left === 0 ? 'Último día' : `En curso · ${left === 1 ? 'queda 1 día' : `quedan ${left} días`}` };
}

function thumb(event) {
  const box = el('div', 'thumb');
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

function track(range, total, start, end, months, todayIndex) {
  const box = el('div', 'track');
  box.setAttribute('aria-hidden', 'true');
  months.slice(1).forEach((m) => {
    const line = el('span', 'month-line');
    line.style.left = `${(m.offset / total) * 100}%`;
    box.append(line);
  });
  if (todayIndex !== null) {
    const line = el('span', 'today-line');
    line.style.left = `${((todayIndex + 0.5) / total) * 100}%`;
    box.append(line);
  }
  const from = start ? Math.max(0, daysBetween(range.start, start)) : 0;
  const to = end ? Math.min(total, daysBetween(range.start, end) + 1) : total;
  if (to <= 0 || from >= total) return box;
  const bar = el('span', 'bar');
  bar.style.left = `${(from / total) * 100}%`;
  bar.style.width = `${(Math.max(to - from, 1) / total) * 100}%`;
  if (!start || start < range.start) bar.classList.add('open-start');
  if (!end || end > range.end) bar.classList.add('open-end');
  if (start && !end) bar.classList.add('release');
  box.append(bar);
  return box;
}

function render(data) {
  const range = { start: parse(data.rango.inicio), end: parse(data.rango.fin) };
  const total = daysBetween(range.start, range.end) + 1;
  const rangeYear = range.start.getFullYear();
  const todayIndex = today >= range.start && today <= range.end ? daysBetween(range.start, today) : null;

  const months = [];
  for (let d = new Date(range.start); d <= range.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const last = next > range.end ? new Date(range.end.getTime() + DAY) : next;
    months.push({ name: monthName.format(d), offset: daysBetween(range.start, d), days: daysBetween(d, last) });
  }

  // Un solo calendario: todo ordenado por fecha de inicio (lo ya disponible primero) y luego por fin.
  const startKey = (e) => (e.inicio ? parse(e.inicio) : range.start).getTime();
  const endKey = (e) => (e.fin ? parse(e.fin) : range.end).getTime();
  const eventos = [...data.eventos].sort((a, b) => startKey(a) - startKey(b) || endKey(a) - endKey(b));

  groupsEl.replaceChildren();
  [{ titulo: 'Esquema de la versión', eventos }].forEach((group, gi) => {
    const section = el('section', 'group');
    const titleId = `grupo-${gi}`;
    section.setAttribute('aria-labelledby', titleId);
    const title = el('h2', 'group-title', group.titulo);
    title.id = titleId;

    const head = el('div', 'board-head');
    head.setAttribute('aria-hidden', 'true');
    const scale = el('div', 'months');
    months.forEach((m) => {
      const pill = el('span', 'month', m.name);
      pill.style.left = `${(m.offset / total) * 100}%`;
      pill.style.width = `${(m.days / total) * 100}%`;
      scale.append(pill);
    });
    if (todayIndex !== null) {
      const flag = el('span', 'today-flag', 'HOY');
      flag.style.left = `${((todayIndex + 0.5) / total) * 100}%`;
      scale.append(flag);
    }
    head.append(el('span', 'head-spacer'), scale);

    const list = el('ul', 'rows');
    group.eventos.forEach((event) => {
      const start = parse(event.inicio);
      const end = parse(event.fin);
      const st = status(start, end);
      const row = el('li', `row state-${st.state}`);
      const info = el('div', 'info');
      const text = el('div', 'text');
      if (event.etiqueta) text.append(el('span', 'tag', event.etiqueta));
      text.append(el('h3', '', event.nombre), el('p', 'dates', dateText(start, end, rangeYear)), el('span', 'status', st.text));
      info.append(thumb(event), text);
      row.append(info, track(range, total, start, end, months, todayIndex));
      list.append(row);
    });

    section.append(title, head, list);
    groupsEl.append(section);
  });
}

fetch('/calendario/eventos.json', { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(render)
  .catch(() => { groupsEl.replaceChildren(el('p', 'loading', 'No se pudo cargar el calendario. Recarga la página.')); });

document.getElementById('year').textContent = new Date().getFullYear();
