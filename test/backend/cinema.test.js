/**
 * Rule-level regression tests: no HTTP server, browser or provider is involved.
 * Fixed instants make programme/expiry boundaries reproducible on every machine.
 * These assertions protect the calculations the voice agent must not invent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, programme, searchScreenings, prepareBooking, confirmBooking } from '../../backend/cinema/service.js';
const now = new Date('2026-09-16T02:00:00Z'); // 10:00 Singapore.

// Singapore midnight happens before UTC midnight. Also check the seven-day
// expansion and that late-in-the-day searches cannot offer already started slots.
test('the programme follows Singapore midnight and excludes started screenings', () => {
  assert.equal(localDate(new Date('2026-09-16T16:01:00Z')), '2026-09-17');
  const p = programme(now);
  assert.equal(p.dates.length, 7);
  assert.equal(p.dates[6], '2026-09-22');
  assert.equal(p.screenings.length, 56);
  const late = programme(new Date('2026-09-16T12:00:00Z'));
  assert.equal(late.screenings.filter(s => s.date === late.today).length, 0);
});

// Equality is excluded for finish-before but included for maxRuntime. Testing
// both 18:36 and 18:37 catches an accidental <= comparison on the cutoff.
test('finish times, runtime constraints and strict finish-before boundaries are calculated', () => {
  const last = searchScreenings({ date: '2026-09-16', filmId: 'last-table' }, now).results[0];
  assert.equal(last.endTime, '18:36');
  assert.equal(searchScreenings({ filmId: 'last-table', endBefore: '18:36' }, now).results.length, 0);
  assert.equal(searchScreenings({ filmId: 'last-table', endBefore: '18:37' }, now).results.length, 1);
  const result = searchScreenings({ mood: 'light', maxRuntime: 119, endBefore: '22:00' }, now);
  assert.deepEqual(result.results.map(s => s.filmId), ['sideways-summer', 'last-table']);
  assert.ok(searchScreenings({ maxRuntime: 119 }, now).results.every(s => s.film.runtime < 120));
});

// Check every date/screen pair, not just today's example. A catalogue slot or
// runtime edit must not place two fictional films on the same screen at once.
test('each screen has a non-overlapping programme', () => {
  const p = programme(now);
  for (const date of p.dates) for (const screen of [1, 2]) {
    const schedule = p.screenings.filter(s => s.date === date && s.screen === screen).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    for (let i = 1; i < schedule.length; i++) assert.ok(new Date(schedule[i - 1].endsAt) <= new Date(schedule[i].startsAt));
  }
});

// Malformed/unsupported constraints throw; a well-formed but impossible request
// returns an empty result. Neither case should manufacture a plausible screening.
test('invalid constraints and impossible combinations cannot fabricate a result', () => {
  for (const args of [{ date: '2026-10-20' }, { endBefore: '25:00' }, { mood: 'unknown' }, { filmId: 'real-film' }, { maxRuntime: '120' }, null]) assert.throws(() => searchScreenings(args, now));
  const empty = searchScreenings({ mood: 'tense', maxRuntime: 80 }, now);
  assert.equal(empty.results.length, 0);
  assert.match(empty.message, /No screenings/);
});

// Quantities must be actual integers, not numeric strings or fractions. A review
// stays unconfirmed until confirmBooking is called with its current ID; expiry
// is checked at the exact ten-minute boundary, and valid retries stay idempotent.
test('booking validates quantity and ID, requires current unexpired review, and retries are stable', () => {
  const args = { screeningId: '2026-09-16_last-table', quantity: 2 };
  for (const quantity of [0, 7, 1.5, '2']) assert.throws(() => prepareBooking({ ...args, quantity }, now));
  assert.throws(() => prepareBooking({ ...args, screeningId: 'invented' }, now));
  const quote = prepareBooking(args, now);
  assert.equal(quote.totalCents, 2400);
  assert.equal(quote.status, 'awaiting_confirmation');
  assert.throws(() => confirmBooking(quote, 'wrong', now));
  assert.throws(() => confirmBooking(quote, quote.id, new Date(now.getTime() + 600000)));
  const result = confirmBooking(quote, quote.id, now);
  assert.equal(result.status, 'confirmed_demo');
  assert.equal(result.reference, confirmBooking(quote, quote.id, now).reference);
  assert.match(result.notice, /No real tickets/);
});
