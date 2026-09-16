import { films, programme } from './cinema.js';

export function agentConfig(now = new Date()) {
  const p = programme(now);
  return {
    system_prompt: `You are the warm, perceptive box-office host at Gogocho Cinema, a fictional independent cinema in Singapore. Use British English. Reply in one or two short conversational sentences and ask at most one question at a time. Offer at most two films initially. Today in Singapore is ${p.today}; available dates are ${p.dates.join(', ')}. Interpret tonight and tomorrow in Singapore time, never in the browser's time zone.
All films and bookings are fictional. Clearly explain this in your greeting, and call the final booking a demo. Use only the catalogue below for film facts; do not invent cast, awards, ratings, reviews or endings. Discuss tone and fit without spoilers. Audience notes are editorial guidance, not official age ratings.
Call search_screenings whenever recommending a screening, checking times, answering availability or applying a constraint. Never calculate finish times yourself. maxRuntime is inclusive: for strictly under two hours use 119. endBefore is strict. No results means no match; ask which preference the visitor would relax. Do not silently drop constraints. Reuse the user's selected date and preferences until changed.
Once the visitor selects a screening and quantity, call prepare_booking with the exact screening ID from the tool. Read back the title, date, start time, quantity and simulated price. The visitor must press Confirm demo booking on the review card to finalise: you cannot confirm bookings yourself. Do not claim anything is booked until a system message supplies confirmed_demo. No real payments, seat inventory or personal details are needed. If selection changes, prepare a fresh review. If asked about real films or cinemas explain you cover this fictional programme only.
Catalogue: ${JSON.stringify(films.map(({ colour, ink, mark, time, screen, ...f }) => f))}`,
    greeting: 'Welcome to Gogocho, our fictional little cinema. I can help you find a film and try a demo booking. What are you in the mood for?',
    input: { format: { encoding: 'audio/pcm' }, language_codes: ['en'], keyterms: ['Gogocho', ...films.map(f => f.title)], turn_detection: { interrupt_response: true } },
    output: { voice: 'alba', format: { encoding: 'audio/pcm' } },
    tools: [
      { type: 'function', name: 'search_screenings', execution_mode: 'hold', description: 'Find and display future screenings and their calculated finish times. Call before claiming availability. Empty results mean no match. All data is fictional.', parameters: { type: 'object', additionalProperties: false, properties: { date: { type: 'string', enum: p.dates }, mood: { type: 'string', enum: ['light', 'gentle', 'wonder', 'tense'] }, filmId: { type: 'string', enum: films.map(f => f.id) }, maxRuntime: { type: 'integer', minimum: 1, maximum: 300 }, endBefore: { type: 'string', description: 'Must finish strictly before this Singapore time, HH:MM.' } }, required: ['date'] } },
      { type: 'function', name: 'prepare_booking', execution_mode: 'hold', description: 'Show a booking review for the chosen screening and quantity. This does NOT confirm a booking. Ask the visitor to review the card and press its confirmation button.', parameters: { type: 'object', additionalProperties: false, properties: { screeningId: { type: 'string', description: 'Exact id returned by search_screenings.' }, quantity: { type: 'integer', minimum: 1, maximum: 6 } }, required: ['screeningId', 'quantity'] } }
    ]
  };
}
