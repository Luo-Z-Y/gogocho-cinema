/** Comparison must preserve the visitor's constraints and never make a started
 * or filtered-out screening bookable merely because its film is being discussed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareFilms } from '../../backend/cinema/service.js';
const now = new Date('2026-09-27T03:00:00Z');
test('comparison preserves strict time constraints while returning original facts', () => {
  const result = compareFilms({ date: '2026-09-28', filmIds: ['last-table', 'sideways-summer'], endBefore: '18:36', maxRuntime: 119 }, now);
  assert.equal(result.films[0].screening, null);
  assert.equal(result.films[1].screening.endTime, '15:48');
  assert.match(result.films[0].conversation, /warm ensemble comedy/i);
  assert.equal(result.fictional, true);
});
test('comparison rejects fabricated, duplicate and oversized selections', () => {
  for (const filmIds of [['last-table'], ['last-table', 'last-table'], ['last-table', 'invented'], ['last-table', 'blue-hour', 'small-orbits']]) {
    assert.throws(() => compareFilms({ date: '2026-09-28', filmIds }, now), /two different films/);
  }
  assert.throws(() => compareFilms({ date: '2025-01-01', filmIds: ['last-table', 'blue-hour'] }, now), /seven days/);
});
