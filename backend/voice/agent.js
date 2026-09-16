/**
 * Non-secret AssemblyAI session configuration, not executable tool handlers.
 *
 * The backend builds this object and the browser sends it in session.update.
 * Tool implementations remain in cinema/service.js behind the HTTP allowlist.
 * Prompt instructions guide model behaviour; they do not replace validation or
 * prove that preferences will be retained correctly in a live conversation.
 */
import { films, programme } from '../cinema/service.js';

/**
 * Build a configuration using the same Singapore clock/catalogue as the API.
 * The date enum is a snapshot at session creation, not the browser's timezone.
 * Never add keys or personal account data: this entire result leaves the server.
 */
export function agentConfig(now = new Date()) {
  const p = programme(now);
  return {
    // Keep the brief explicit about fictional content, strict time constraints
    // and the human confirmation boundary. Catalogue facts are embedded for
    // discussion; poster styling and daily slots are omitted so screening-time
    // recommendations must use a tool. The string itself is provider input.
    system_prompt: `You are the warm, perceptive box-office host at Gogocho Cinema, a fictional independent cinema in Singapore. Use British English. Reply in one or two short conversational sentences and ask at most one question at a time. Offer at most two films initially. Today in Singapore is ${p.today}; available dates are ${p.dates.join(', ')}. Interpret tonight and tomorrow in Singapore time, never in the browser's time zone.
All films and bookings are fictional. Clearly explain this in your greeting, and call the final booking a demo. Use only the catalogue below for film facts; do not invent cast, awards, ratings, reviews or endings. Discuss tone and fit without spoilers. Audience notes are editorial guidance, not official age ratings.
Call search_screenings whenever recommending a screening, checking times, answering availability or applying a constraint. Never calculate finish times yourself. maxRuntime is inclusive: for strictly under two hours use 119. endBefore is strict. No results means no match; ask which preference the visitor would relax. Do not silently drop constraints. Reuse the user's selected date and preferences until changed.
Once the visitor selects a screening and quantity, call prepare_booking with the exact screening ID from the tool. Read back the title, date, start time, quantity and simulated price. The visitor must press Confirm demo booking on the review card to finalise: you cannot confirm bookings yourself. Do not claim anything is booked until a system message supplies confirmed_demo. No real payments, seat inventory or personal details are needed. If selection changes, prepare a fresh review. If asked about real films or cinemas explain you cover this fictional programme only.
Catalogue: ${JSON.stringify(films.map(({ colour, ink, mark, time, screen, ...f }) => f))}`,
    // The fictional/demo disclosure is part of the first spoken interaction,
    // rather than relying only on the page's visual notice.
    greeting: 'Welcome to Gogocho, our fictional little cinema. I can help you find a film and try a demo booking. What are you in the mood for?',
    // Keyterms help recognise our original titles. Provider turn detection can
    // interrupt a reply; the browser still has to stop its queued playback when
    // the interruption event arrives. PCM conversion happens in the frontend.
    input: { format: { encoding: 'audio/pcm' }, language_codes: ['en'], keyterms: ['Gogocho', ...films.map(f => f.title)], turn_detection: { interrupt_response: true } },
    // Match the browser's PCM playback path; the named voice is a provider option.
    output: { voice: 'alba', format: { encoding: 'audio/pcm' } },
    // Both tools use hold mode: the provider waits for tool.result and resumes
    // that reply itself. Sending reply.create as well would start a second reply.
    tools: [
      // Search parameters are a machine-readable contract: allowed dates/moods
      // and film IDs constrain model output, while the service validates again.
      // Inclusive maxRuntime and strict endBefore deliberately differ.
      { type: 'function', name: 'search_screenings', execution_mode: 'hold', description: 'Find and display future screenings and their calculated finish times. Call before claiming availability. Empty results mean no match. All data is fictional.', parameters: { type: 'object', additionalProperties: false, properties: { date: { type: 'string', enum: p.dates }, mood: { type: 'string', enum: ['light', 'gentle', 'wonder', 'tense'] }, filmId: { type: 'string', enum: films.map(f => f.id) }, maxRuntime: { type: 'integer', minimum: 1, maximum: 300 }, endBefore: { type: 'string', description: 'Must finish strictly before this Singapore time, HH:MM.' } }, required: ['date'] } },
      // Only prepare a review from a returned screening ID and integer quantity.
      // There is no confirm_booking schema: finalisation is a separate page action.
      { type: 'function', name: 'prepare_booking', execution_mode: 'hold', description: 'Show a booking review for the chosen screening and quantity. This does NOT confirm a booking. Ask the visitor to review the card and press its confirmation button.', parameters: { type: 'object', additionalProperties: false, properties: { screeningId: { type: 'string', description: 'Exact id returned by search_screenings.' }, quantity: { type: 'integer', minimum: 1, maximum: 6 } }, required: ['screeningId', 'quantity'] } }
    ]
  };
}
