/** Generate an optional calendar keepsake from a confirmed demo result only.
 * UTC timestamps preserve the Singapore screening in any calendar timezone.
 * Escape iCalendar text, and keep the fictional/no-reservation notice in the
 * event itself so an exported file cannot be mistaken for a real cinema ticket. */
export function calendarTicket(receipt) {
  if (receipt?.status !== 'confirmed_demo' || !receipt.fictional) throw new Error('Confirm the demo booking first.');
  const text = value => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const date = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gogocho//Fictional Cinema//EN', 'BEGIN:VEVENT',
    `UID:${receipt.reference}@gogocho.demo`, `DTSTAMP:${date(new Date())}`,
    `DTSTART:${date(receipt.screening.startsAt)}`, `DTEND:${date(receipt.screening.endsAt)}`,
    `SUMMARY:${text(`DEMO — ${receipt.film.title}`)}`,
    `DESCRIPTION:${text(`${receipt.quantity} demo tickets. Fictional cinema; no payment, tickets or seats reserved. ${receipt.reference}`)}`,
    'LOCATION:Gogocho — fictional cinema', 'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}
