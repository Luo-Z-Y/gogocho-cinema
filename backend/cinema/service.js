/**
 * Authoritative rules for the fictional cinema, independent of HTTP and voice.
 *
 * Both form requests and agent tools use these functions, so neither the UI nor
 * the model decides valid screening IDs, end times, quantities or prices. The
 * clock is injectable for boundary tests. Reviews have random IDs; programme
 * calculations themselves depend only on the catalogue and the supplied clock.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Load original catalogue data once per module instance. A module-relative URL
// works regardless of the process cwd; JSON stays comment-free and is described
// in README.md. scripts/check.js validates its copy, timings and colour fields.
export const films = JSON.parse(readFileSync(new URL('./films.json', import.meta.url), 'utf8'));
export const TIME_ZONE = 'Asia/Singapore';
// Store money as integer cents, not floating-point dollars. This is a simulated
// price only; preparing/confirming a review does not charge or reserve anything.
export const TICKET_CENTS = 1200;

/** Return the cinema's YYYY-MM-DD date, not the server/browser's local date. */
export function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
/**
 * Advance a Singapore calendar date by whole days. Singapore has a fixed UTC+08
 * offset; anchoring at noon leaves the UTC ISO date on the same calendar day.
 * This is intentionally not a general daylight-saving-aware calendar helper.
 */
export function datePlus(date, days) {
  return new Date(new Date(`${date}T12:00:00+08:00`).getTime() + days * 86400000).toISOString().slice(0, 10);
}
/** Format an instant as Singapore HH:MM, using 00 rather than 24 at midnight. */
export function clock(iso) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
/**
 * Expand each film's daily slot into the rolling seven-day programme.
 * The date and film ID form the stable screening identifier reused by tools.
 * Start times include the Singapore offset; end times are stored as UTC ISO
 * instants and separately formatted for display. Exclude starts at or before
 * `now`: the model must not add runtimes or decide whether a slot has started.
 */
export function programme(now = new Date()) {
  const today = localDate(now);
  const dates = Array.from({ length: 7 }, (_, i) => datePlus(today, i));
  const screenings = dates.flatMap(date => films.map(film => {
    const startsAt = `${date}T${film.time}:00+08:00`;
    const endsAt = new Date(new Date(startsAt).getTime() + film.runtime * 60000).toISOString();
    return { id: `${date}_${film.id}`, filmId: film.id, date, screen: film.screen, startsAt, endsAt, startTime: film.time, endTime: clock(endsAt), priceCents: TICKET_CENTS };
  })).filter(s => new Date(s.startsAt) > now);
  return { fictional: true, timeZone: TIME_ZONE, today, dates, films, screenings };
}
/**
 * Validate supplied filters, then return dated screenings joined with film copy.
 * maxRuntime is inclusive (119 means strictly under two hours); endBefore is
 * exclusive. Omitted preferences impose no restriction. The agent is responsible
 * for carrying conversation preferences forward: this function cannot detect a
 * preference that the caller forgot to send.
 * @throws {Error} For unsupported dates/IDs/moods or malformed numeric/time input.
 */
export function searchScreenings(args = {}, now = new Date()) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Filters must be an object.');
  const p = programme(now);
  // Direct UI/API searches may omit the date and use today. The voice tool's
  // schema asks the model for an explicit date to avoid losing conversational
  // context; the server still validates it independently of that schema.
  const date = args.date || p.today;
  if (!p.dates.includes(date)) throw new Error('Choose a date within the next seven days.');
  if (args.filmId && !films.some(f => f.id === args.filmId)) throw new Error('That film is not in our fictional programme.');
  if (args.mood && !['light', 'gentle', 'wonder', 'tense'].includes(args.mood)) throw new Error('Choose a listed mood.');
  if (args.maxRuntime !== undefined && (!Number.isInteger(args.maxRuntime) || args.maxRuntime < 1 || args.maxRuntime > 300)) throw new Error('Runtime must be between 1 and 300 minutes.');
  if (args.endBefore && !/^([01]\d|2[0-3]):[0-5]\d$/.test(args.endBefore)) throw new Error('Finish time must use HH:MM.');
  // Apply every supplied constraint together. Compare finish times as instants,
  // not strings, so a next-day finish cannot masquerade as an earlier time.
  // Finally order by start time and attach the catalogue details for UI/speech.
  const results = p.screenings.filter(s => {
    const f = films.find(f => f.id === s.filmId);
    return s.date === date && (!args.filmId || f.id === args.filmId)
      && (!args.mood || f.mood === args.mood)
      && (args.maxRuntime === undefined || f.runtime <= args.maxRuntime)
      && (!args.endBefore || new Date(s.endsAt) < new Date(`${date}T${args.endBefore}:00+08:00`));
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(s => ({ ...s, film: films.find(f => f.id === s.filmId) }));
  // A valid empty search is not an exception and must not fabricate a screening
  // or silently relax a constraint. The caller can ask which preference to change.
  return { fictional: true, date, results, message: results.length ? 'Matching fictional screenings.' : 'No screenings meet these filters. Ask which preference to change.' };
}
/**
 * Create a ten-minute review, not a booking. Resolve the exact screening ID
 * against a freshly generated future programme; never trust client-sent prices
 * or screening details. The HTTP layer stores this review against its cookie.
 * A changed selection/quantity gets a new ID so stale confirmation is rejected.
 */
export function prepareBooking(args, now = new Date()) {
  if (!args || !Number.isInteger(args.quantity) || args.quantity < 1 || args.quantity > 6) throw new Error('Choose between one and six tickets.');
  const screening = programme(now).screenings.find(s => s.id === args.screeningId);
  if (!screening) throw new Error('Choose a future screening from the current programme.');
  return { id: randomUUID(), fictional: true, status: 'awaiting_confirmation', screening, film: films.find(f => f.id === screening.filmId), quantity: args.quantity, totalCents: screening.priceCents * args.quantity, expiresAt: new Date(now.getTime() + 10 * 60000).toISOString() };
}

/** Compare exactly two original films without inventing availability or relaxing
 * the current search constraints. A film can be discussed even when its screening
 * does not match: its screening is then null and the UI offers no booking button.
 * Reuse searchScreenings so date, runtime and strict finish boundaries agree. */
export function compareFilms(args, now = new Date()) {
  if (!args || !Array.isArray(args.filmIds) || args.filmIds.length !== 2 || new Set(args.filmIds).size !== 2
    || args.filmIds.some(id => !films.some(f => f.id === id))) throw new Error('Choose two different films from this programme.');
  const { filmIds, ...constraints } = args;
  const result = searchScreenings(constraints, now);
  return { fictional: true, date: result.date, films: filmIds.map(id => ({
    ...films.find(f => f.id === id), screening: result.results.find(s => s.filmId === id) || null
  })) };
}
/**
 * Validate the current server-held review and return a fictional confirmation.
 * Both its TTL and the screening start are checked, including exact boundaries.
 * The result is a copy: this function does not persist a confirmed state, take
 * payment or hold seats. Repeated valid requests derive the same DEMO reference
 * from the review ID; retries after expiry still fail rather than revive it.
 */
export function confirmBooking(quote, quoteId, now = new Date()) {
  if (!quote || quote.id !== quoteId) throw new Error('This selection has changed. Review it again before confirming.');
  if (new Date(quote.expiresAt) <= now || new Date(quote.screening.startsAt) <= now) throw new Error('This selection has expired. Please choose a screening again.');
  return { ...quote, status: 'confirmed_demo', reference: `DEMO-${quote.id.slice(0, 8).toUpperCase()}`, notice: 'Simulation only. No payment taken. No real tickets or seats reserved.' };
}
