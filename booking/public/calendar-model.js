// Presentation-only helpers. API timestamps always remain Unix seconds.
const dayFormatters = new Map();
export function dateKey(seconds, zone) {
  if (!dayFormatters.has(zone)) dayFormatters.set(zone, new Intl.DateTimeFormat('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}));
  const parts = Object.fromEntries(dayFormatters.get(zone).formatToParts(new Date(seconds * 1000)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function groupSlots(slots, zone) {
  const groups = new Map();
  for (const start of [...new Set(slots.filter(s => Number.isSafeInteger(s.start) && s.start > 0).map(s => s.start))].sort((a, b) => a - b)) {
    const key = dateKey(start, zone);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(start);
  }
  return groups;
}
export function monthGrid(month) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = first.getUTCDay();
  return Array.from({length: Math.ceil((offset + length) / 7) * 7}, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= length ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
}
export function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function reconcileSelection(selection, slots, limit) {
  const valid = new Set(slots.map(s => s.start));
  return new Set([...selection].filter(start => valid.has(start)).slice(0, limit));
}
export function toggleSelection(selection, start, quantity) {
  const next = new Set(selection);
  if (next.has(start)) next.delete(start);
  else if (quantity === 1) { next.clear(); next.add(start); }
  else if (next.size < quantity) next.add(start);
  return next;
}
