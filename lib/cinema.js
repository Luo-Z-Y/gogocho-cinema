import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export const films = JSON.parse(readFileSync(new URL('../data/films.json', import.meta.url), 'utf8'));
export const TIME_ZONE = 'Asia/Singapore';
export const TICKET_CENTS = 1200;
export function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function datePlus(date, days) {
  return new Date(new Date(`${date}T12:00:00+08:00`).getTime() + days * 86400000).toISOString().slice(0, 10);
}
export function clock(iso) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
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
export function searchScreenings(args = {}, now = new Date()) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Filters must be an object.');
  const p = programme(now);
  const date = args.date || p.today;
  if (!p.dates.includes(date)) throw new Error('Choose a date within the next seven days.');
  if (args.filmId && !films.some(f => f.id === args.filmId)) throw new Error('That film is not in our fictional programme.');
  if (args.mood && !['light', 'gentle', 'wonder', 'tense'].includes(args.mood)) throw new Error('Choose a listed mood.');
  if (args.maxRuntime !== undefined && (!Number.isInteger(args.maxRuntime) || args.maxRuntime < 1 || args.maxRuntime > 300)) throw new Error('Runtime must be between 1 and 300 minutes.');
  if (args.endBefore && !/^([01]\d|2[0-3]):[0-5]\d$/.test(args.endBefore)) throw new Error('Finish time must use HH:MM.');
  const results = p.screenings.filter(s => {
    const f = films.find(f => f.id === s.filmId);
    return s.date === date && (!args.filmId || f.id === args.filmId)
      && (!args.mood || f.mood === args.mood)
      && (args.maxRuntime === undefined || f.runtime <= args.maxRuntime)
      && (!args.endBefore || new Date(s.endsAt) < new Date(`${date}T${args.endBefore}:00+08:00`));
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(s => ({ ...s, film: films.find(f => f.id === s.filmId) }));
  return { fictional: true, date, results, message: results.length ? 'Matching fictional screenings.' : 'No screenings meet these filters. Ask which preference to change.' };
}
export function prepareBooking(args, now = new Date()) {
  if (!args || !Number.isInteger(args.quantity) || args.quantity < 1 || args.quantity > 6) throw new Error('Choose between one and six tickets.');
  const screening = programme(now).screenings.find(s => s.id === args.screeningId);
  if (!screening) throw new Error('Choose a future screening from the current programme.');
  return { id: randomUUID(), fictional: true, status: 'awaiting_confirmation', screening, film: films.find(f => f.id === screening.filmId), quantity: args.quantity, totalCents: screening.priceCents * args.quantity, expiresAt: new Date(now.getTime() + 10 * 60000).toISOString() };
}
export function confirmBooking(quote, quoteId, now = new Date()) {
  if (!quote || quote.id !== quoteId) throw new Error('This selection has changed. Review it again before confirming.');
  if (new Date(quote.expiresAt) <= now || new Date(quote.screening.startsAt) <= now) throw new Error('This selection has expired. Please choose a screening again.');
  return { ...quote, status: 'confirmed_demo', reference: `DEMO-${quote.id.slice(0, 8).toUpperCase()}`, notice: 'Simulation only. No payment taken. No real tickets or seats reserved.' };
}
