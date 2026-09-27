/** An exported keepsake must preserve timezones and its fictional status. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarTicket } from '../../frontend/booking.js';
import { prepareBooking, confirmBooking } from '../../backend/cinema/service.js';
test('calendar export requires confirmation and carries exact UTC times and demo notice', () => {
  const now = new Date('2026-09-27T03:00:00Z');
  const quote = prepareBooking({ screeningId: '2026-09-28_last-table', quantity: 2 }, now);
  assert.throws(() => calendarTicket(quote), /Confirm/);
  const result = calendarTicket(confirmBooking(quote, quote.id, now));
  assert.match(result, /DTSTART:20260928T090000Z/);
  assert.match(result, /DTEND:20260928T103600Z/);
  assert.match(result, /SUMMARY:DEMO — The Last Table/);
  assert.match(result, /no payment\\, tickets or seats reserved/);
  assert.match(result, /STATUS:TENTATIVE/);
});
