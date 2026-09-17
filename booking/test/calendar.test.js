import test from 'node:test';
import assert from 'node:assert/strict';
import {dateKey, groupSlots, monthGrid, shiftMonth, reconcileSelection, toggleSelection} from '../public/calendar-model.js';
const timestamp = value => Date.parse(value) / 1000;
test('month grid includes leap days, starts on Sunday and handles six-week months', () => {
  const leap = monthGrid('2028-02');
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap[2], '2028-02-01');
  assert.equal(monthGrid('2026-08').length, 42);
  assert.equal(monthGrid('2026-02').length, 28);
});
test('month navigation crosses year boundaries', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
test('grouping uses viewer time zone, never the server day, and retains timestamps', () => {
  const start = timestamp('2026-09-18T01:00:00Z');
  const slots = [{start, day: '2026-09-17'}];
  assert.equal(dateKey(start, 'America/Hermosillo'), '2026-09-17');
  assert.deepEqual([...groupSlots(slots, 'Europe/Madrid')], [['2026-09-18', [start]]]);
});
test('DST grouping is correct for repeated and skipped local hours', () => {
  const fall = ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'].map(s => ({start: timestamp(s)}));
  assert.equal(groupSlots(fall, 'America/New_York').get('2026-11-01').length, 2);
  const spring = ['2026-03-08T06:30:00Z', '2026-03-08T07:30:00Z'].map(s => ({start: timestamp(s)}));
  assert.equal(groupSlots(spring, 'America/New_York').get('2026-03-08').length, 2);
});
test('slots are sorted, deduplicated and invalid timestamps are ignored', () => {
  const groups = groupSlots([{start: 200}, {start: 100}, {start: 100}, {start: '300'}, {start: -1}], 'UTC');
  assert.deepEqual([...groups.values()].flat(), [100, 200]);
});
test('one session replaces the previous choice; a chosen session can be removed', () => {
  const source = new Set([100]);
  assert.deepEqual([...toggleSelection(source, 200, 1)], [200]);
  assert.deepEqual([...source], [100]);
  assert.equal(toggleSelection(source, 100, 1).size, 0);
});
test('packages keep choices across dates and refuse selections above the limit', () => {
  let selection = new Set();
  for (let day = 1; day <= 6; day++) selection = toggleSelection(selection, day * 86400, 5);
  assert.equal(selection.size, 5);
  assert.equal(toggleSelection(selection, 86400, 5).size, 4);
});
test('refresh removes only unavailable selections; changing plans preserves first choices', () => {
  const selection = new Set([300, 100, 200]);
  assert.deepEqual([...reconcileSelection(selection, [{start: 100}, {start: 200}], 5)], [100, 200]);
  assert.deepEqual([...reconcileSelection(selection, [{start: 100}, {start: 200}, {start: 300}], 1)], [300]);
  assert.equal(reconcileSelection(selection, [], 3).size, 0);
});
