/**
 * Browser presentation and coordination layer.
 *
 * This module owns the DOM, form submissions and demo review dialogue. It never
 * calculates authoritative screenings/prices or accesses the provider key.
 * VoiceBoxOffice owns audio/protocol details and calls back here when a tool
 * should use the same HTTP API as a button-driven interaction.
 */
import { VoiceBoxOffice } from './voice/client.js';
import { calendarTicket } from './booking.js';
// All elements exist by the time this deferred ES module runs.
const $ = s => document.querySelector(s);
const form = $('#filters');
const booking = $('#booking');
// data is the initial programme; quote is the displayed server-issued review.
// Version counters suppress superseded direct search/review responses. They are
// UI guards, not transaction locks: the backend still validates the current quote.
let data, quote, receipt, preview, searchVersion = 0, quoteVersion = 0, voice;
const comparison = $('#comparison');
const selectedFilms = new Set();
// Convert integer cents only for display. Anchor date-only labels at Singapore
// noon so neither the host timezone nor UTC parsing shifts the displayed day.
const currency = n => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n / 100);
const dateLabel = date => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00+08:00`));
// Catalogue text and identifiers belong in HTML as data, not executable markup.
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
/** Show a transient, text-only alert; replace the previous dismissal timer. */
function notice(message) { $('#notice').textContent = message; $('#notice').hidden = false; clearTimeout(notice.timer); notice.timer = setTimeout(() => $('#notice').hidden = true, 6500); }
/**
 * Send a same-origin JSON request. Fetch carries the HttpOnly session cookie
 * automatically; the page neither reads nor constructs that cookie. Turn an
 * HTTP error into an exception so UI and voice callers share the error path.
 */
async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || 'Please try again.');
  return value;
}
/**
 * Translate native form values into tool arguments. Blank choices mean no
 * restriction; a disabled finish-time input is omitted by FormData. Runtime
 * must become a number rather than the string returned by a select element.
 */
function filters() {
  const values = Object.fromEntries(new FormData(form));
  return Object.fromEntries(Object.entries(values).filter(([,v]) => v !== '').map(([k,v]) => [k, k === 'maxRuntime' ? Number(v) : v]));
}
/**
 * Keep the compact Any time / time-input states consistent for clicks, reset
 * and voice results. Disabled prevents an inactive cutoff entering a request;
 * required prevents submitting an empty cutoff while editing. The visible
 * label follows the active control, and both states use the same CSS height.
 */
function syncFinishTime(specific = Boolean(form.elements.endBefore.value)) {
  const input = form.elements.endBefore;
  $('#finish-any').hidden = specific;
  $('#finish-clear').hidden = !specific;
  $('#finish-label').htmlFor = specific ? 'finish-time' : 'finish-any';
  input.hidden = input.disabled = !specific;
  input.required = specific;
  if (!specific) input.value = '';
}
/**
 * Render server-returned screenings, including their already calculated times.
 * Poster colours come from the checked original catalogue; copy/IDs are escaped.
 * Native details/summary keeps optional descriptions keyboard-operable without
 * another client-side component. An empty array gets an explicit recovery state.
 */
function renderFilms(results) {
  $('#film-count').textContent = `${results.length} screening${results.length === 1 ? '' : 's'}`;
  $('#films').innerHTML = results.length ? results.map(s => {
    const f = s.film;
    return `<article class="film"><div class="poster" style="--film:${f.colour};--ink:${f.ink}"><img src="/assets/posters/${escape(f.id)}.svg" alt="" loading="lazy" width="480" height="720"><span class="poster-index" aria-hidden="true">G / ${f.mark}</span><h3 class="poster-title">${escape(f.title)}</h3></div><div class="film-info"><p class="film-meta">${escape(f.genre)} <span>· ${f.runtime} min</span></p><button class="compare-toggle" data-compare="${escape(f.id)}" aria-label="Compare ${escape(f.title)}" aria-pressed="${selectedFilms.has(f.id)}">${selectedFilms.has(f.id) ? '✓ Added' : '+ Compare'}</button></div><button class="screening" data-screening="${escape(s.id)}" aria-label="Select ${escape(f.title)} at ${s.startTime}"><span class="screening-start">${s.startTime}</span><span>Screen ${s.screen} · Ends ${s.endTime}</span><span aria-hidden="true">↗</span></button><details class="film-details"><summary aria-label="Details about ${escape(f.title)}">The story</summary><p>${escape(f.description)}</p><p>${escape(f.language)} · ${escape(f.audience)}</p><p>${escape(f.contentNotes)}</p></details></article>`;
  }).join('') : '<div class="empty"><span aria-hidden="true">◌</span><h3>A different kind of evening?</h3><p>No films fit these filters.</p><button type="button" class="secondary" id="empty-reset">Show the programme</button></div>';
  if ($('#empty-reset')) $('#empty-reset').onclick = () => $('#reset').click();
}
/** Mark the real application step; this is not a claim about model reasoning. */
function journey(step) {
  for (const item of $('#journey').children) item.classList.toggle('current', item.dataset.stage === step);
}
/** Keep a small, explicit two-film shortlist; never silently replace a choice. */
function updateCompareTray() {
  $('#compare-tray').hidden = !selectedFilms.size;
  $('#compare-open').disabled = selectedFilms.size !== 2;
  $('#compare-selection').textContent = selectedFilms.size === 1 ? 'Choose one more film' : 'Two films. One evening.';
  for (const button of document.querySelectorAll('[data-compare]')) {
    const selected = selectedFilms.has(button.dataset.compare);
    button.setAttribute('aria-pressed', String(selected)); button.textContent = selected ? '✓ Added' : '+ Compare';
  }
}
/** Render original film facts and only screening choices allowed by the search. */
function showComparison(result) {
  $('#comparison-films').innerHTML = result.films.map(f => `<article><img class="comparison-art" src="/assets/posters/${escape(f.id)}.svg" alt="" width="480" height="720"><p class="eyebrow">${escape(f.genre)} · ${f.runtime} min</p><h3>${escape(f.title)}</h3><p>${escape(f.conversation)}</p><p class="muted">${escape(f.contentNotes)}</p>${f.screening ? `<button type="button" class="secondary" data-screening="${escape(f.screening.id)}" aria-label="Choose ${escape(f.title)}">${f.screening.startTime} → ${f.screening.endTime}<span>Choose film ↗</span></button>` : '<p class="muted">No screening matches your current filters.</p>'}</article>`).join('');
  journey('compare');
  if (booking.open) booking.close();
  if (!comparison.open) comparison.showModal();
}
/** Only the latest direct form search may replace the displayed programme. */
async function search() {
  const version = ++searchVersion;
  try { const result = await post('/api/tool', { name: 'search_screenings', arguments: filters() }); if (version === searchVersion) renderFilms(result.results); }
  catch (e) { if (version === searchVersion) notice(e.message); }
}
/**
 * Display an awaiting-confirmation review exactly as returned by the backend.
 * showModal provides native modal/focus behaviour. Rendering a review must not
 * submit it: confirmation remains a separate form action below.
 */
function showQuote(value) {
  quote = value; receipt = null;
  if (comparison.open) comparison.close();
  $('#ticket-actions').hidden = true;
  booking.classList.remove('confirmed');
  journey('book');
  if (preview) { preview.step = 3; updatePreview(); }
  $('#booking-heading').textContent = 'Review booking';
  $('#booking-details').innerHTML = `<h3>${escape(value.film.title)}</h3><div class="booking-row"><span>Screening</span><span>${escape(dateLabel(value.screening.date))}, ${value.screening.startTime}</span></div><div class="booking-row"><span>Screen ${value.screening.screen}</span><span>Ends ${value.screening.endTime} SGT</span></div><div class="booking-row"><span>Demo total · ${value.quantity} ticket${value.quantity === 1 ? '' : 's'}</span><strong>${currency(value.totalCents)}</strong></div>`;
  $('#quantity').value = value.quantity;
  $('#quantity').disabled = false;
  $('#booking-form').hidden = false;
  $('#confirm').disabled = false;
  $('#booking-message').textContent = '';
  if (!booking.open) booking.showModal();
}
/**
 * Ask for a fresh review and disable confirmation while its details are stale.
 * A quantity change uses this same path instead of recalculating a total locally.
 */
async function prepare(screeningId, quantity) {
  const version = ++quoteVersion;
  $('#confirm').disabled = true;
  try { const result = await post('/api/tool', { name: 'prepare_booking', arguments: { screeningId, quantity } }); if (version === quoteVersion) showQuote(result); }
  catch(e) { if (version === quoteVersion) { $('#booking-message').textContent = e.message; notice(e.message); } }
}
// Delegate screening clicks from the stable grid container: renderFilms replaces
// its children, so handlers attached to individual film buttons would be lost.
$('#films').addEventListener('click', e => { const button = e.target.closest('[data-screening]'); if (button) prepare(button.dataset.screening, 2); });
// Prevent full-page navigation, which would discard the conversation. These
// finish-control actions explicitly restore keyboard focus after changing state.
form.addEventListener('submit', e => { e.preventDefault(); search(); });
$('#finish-any').onclick = () => { syncFinishTime(true); form.elements.endBefore.focus(); };
$('#finish-clear').onclick = () => { syncFinishTime(false); $('#finish-any').focus(); };
$('#reset').onclick = () => { form.reset(); syncFinishTime(); form.elements.date.value = data.today; search(); };
// Closing the dialogue is not confirmation (or a backend cancellation). The
// stored review is still governed by its expiry and the next prepared selection.
$('#close-booking').onclick = () => booking.close();
$('#quantity').onchange = () => { if (quote) prepare(quote.screening.id, Number($('#quantity').value)); };
// Only this explicit page action calls /api/confirm. Disable both controls while
// it runs to avoid accidental repeat submissions or a quantity edit in flight.
// The server still checks the cookie-scoped review ID and expiry on every retry.
$('#booking-form').onsubmit = async e => {
  e.preventDefault(); if (!quote) return;
  $('#confirm').disabled = true; $('#quantity').disabled = true;
  try {
    const result = await post('/api/confirm', { quoteId: quote.id });
    receipt = result; booking.classList.add('confirmed');
    $('#booking-heading').textContent = 'Your evening, sorted.';
    $('#ticket-actions').hidden = false;
    if (preview) { preview.step = 4; updatePreview(); }
    $('#booking-form').hidden = true;
    $('#booking-message').textContent = `DEMO TICKET · ${result.reference}`;
    // Let an active agent acknowledge a real application result only after the
    // HTTP confirmation succeeds. This adds context; it is not another tool call.
    voice?.context(`The visitor explicitly pressed Confirm demo booking. Result: ${JSON.stringify(result)}`);
  } catch(e) { $('#booking-message').textContent = e.message; $('#quantity').disabled = false; $('#confirm').disabled = false; }
};

/**
 * Bridge voice tool events to the same validated backend used by manual controls.
 * Reflect the tool's actual filter arguments, not a mixture with old form values.
 * Advance the UI counters so older direct requests cannot overwrite this result.
 * Return the complete result to the voice client for its matching tool.result.
 */
async function runTool(name, args) {
  const version = name === 'prepare_booking' ? ++quoteVersion : ++searchVersion;
  const result = await post('/api/tool', { name, arguments: args });
  if (name === 'search_screenings' && version === searchVersion) {
    form.reset();
    for (const [key,value] of Object.entries(args)) if (form.elements[key]) {
      // Voice may request an exact runtime not present among the two shortcuts.
      // Add it as an option so a subsequent manual search retains that constraint.
      if (key === 'maxRuntime' && ![...form.elements[key].options].some(o => o.value === String(value))) form.elements[key].add(new Option(`Up to ${value} min`, String(value)));
      form.elements[key].value = String(value);
    }
    syncFinishTime(); renderFilms(result.results); journey('find');
  } else if (name === 'compare_films' && version === searchVersion) showComparison(result);
  else if (name === 'prepare_booking' && version === quoteVersion) showQuote(result);
  return result;
}
/** A deterministic, explicitly labelled preview calls the real cinema API. It
 * never opens a provider session or pretends that its scripted copy is live AI.
 * Each step needs a click, and final confirmation uses the ordinary review form. */
function updatePreview() {
  const messages = ['Find a light film for tomorrow, under two hours.', 'Two good options. Compare their moods and timings.', 'Choose a film, or review two tickets for The Last Table.', 'Check the details, then confirm on screen.', 'All set. Your fictional ticket is ready.'];
  const actions = ['Find films', 'Compare the two', 'Review two tickets'];
  $('#preview-step').textContent = preview.step === 4 ? 'Preview complete' : `Guided preview · ${Math.min(preview.step + 1, 3)} / 3`;
  $('#preview-copy').textContent = messages[preview.step];
  $('#preview-next').hidden = preview.step >= 3;
  $('#preview-next').textContent = actions[preview.step] || '';
}
function endPreview() { preview = null; $('#preview').hidden = true; $('#preview-start').hidden = false; }
async function advancePreview() {
  if (!preview) return;
  $('#preview-next').disabled = true;
  try {
    const constraints = { date: preview.date, mood: 'light', maxRuntime: 119, endBefore: '22:00' };
    if (preview.step === 0) { await runTool('search_screenings', constraints); preview.step = 1; }
    else if (preview.step === 1) { await runTool('compare_films', { ...constraints, filmIds: ['last-table', 'sideways-summer'] }); preview.step = 2; }
    else await runTool('prepare_booking', { screeningId: `${preview.date}_last-table`, quantity: 2 });
    updatePreview();
  } catch (error) { notice(error.message); }
  finally { $('#preview-next').disabled = false; }
}
// Event delegation also works when comparison content is replaced by a tool.
$('#films').addEventListener('click', e => {
  const button = e.target.closest('[data-compare]'); if (!button) return;
  const id = button.dataset.compare;
  if (selectedFilms.has(id)) selectedFilms.delete(id);
  else if (selectedFilms.size < 2) selectedFilms.add(id);
  else return notice('Choose up to two films. Remove one to compare another.');
  updateCompareTray();
});
$('#compare-clear').onclick = () => { selectedFilms.clear(); updateCompareTray(); };
$('#compare-open').onclick = async () => {
  try { await runTool('compare_films', { ...filters(), filmIds: [...selectedFilms] }); }
  catch (error) { notice(error.message); }
};
$('#close-comparison').onclick = () => comparison.close();
$('#comparison-films').onclick = e => { const b = e.target.closest('[data-screening]'); if (b) prepare(b.dataset.screening, 2); };
$('#preview-close').onclick = endPreview;
$('#preview-next').onclick = advancePreview;
$('#preview-start').onclick = () => {
  if (voice?.active || voice?.starting) voice.stop();
  preview = { step: 0, date: data.dates[1] };
  $('#preview').hidden = false; $('#preview-start').hidden = true; updatePreview();
};
// Download only after server confirmation. Revoke the temporary object URL to
// avoid retaining files in memory; no data is sent to a calendar service.
$('#save-ticket').onclick = () => {
  if (!receipt) return;
  const url = URL.createObjectURL(new Blob([calendarTicket(receipt)], { type: 'text/calendar' }));
  const link = document.createElement('a'); link.href = url; link.download = `${receipt.reference}.ics`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
/**
 * Update a stable message row as partial transcripts arrive. textContent keeps
 * provider text inert. Retain at most 100 DOM messages and scroll to the latest;
 * this is an in-memory display, not saved chat history or an audio recording.
 */
function transcript(role, text, id) {
  let line = [...$('#transcript').children].find(el => el.dataset.id === id);
  if (!line) { line = document.createElement('p'); line.className = 'utterance'; line.dataset.id = id; const label = document.createElement('strong'); label.textContent = role === 'user' ? 'You' : 'Box office'; line.append(label, document.createElement('span')); $('#transcript').append(line); }
  line.lastChild.textContent = text;
  while ($('#transcript').children.length > 100) $('#transcript').firstChild.remove();
  $('#transcript').scrollTop = $('#transcript').scrollHeight;
}
/**
 * Bootstrap the dated programme before enabling microphone/session controls.
 * All DOM-specific voice behaviour is injected as callbacks, keeping the voice
 * class reusable and testable without importing this page module.
 */
async function init() {
  try {
    const r = await fetch('/api/programme'); if (!r.ok) throw new Error('The programme could not be loaded.'); data = await r.json();
    $('#date').innerHTML = data.dates.map((d,i) => `<option value="${d}">${i === 0 ? 'Today · ' : i === 1 ? 'Tomorrow · ' : ''}${dateLabel(d)}</option>`).join('');
    form.elements.date.value = data.screenings[0]?.date || data.today;
    await search();
    // State callbacks keep button availability aligned with capture/connection
    // initialisation; rapid clicks must not start overlapping setup attempts.
    voice = new VoiceBoxOffice({ post, runTool, transcript, activity: message => { $('#voice-activity').textContent = message; }, state: (active, message) => {
      $('.box-office').classList.toggle('live', active);
      $('#voice-start').textContent = active ? 'End conversation' : 'Start talking ↗';
      $('#voice-start').disabled = Boolean(voice?.starting || voice?.testing);
      $('#mic-test').disabled = Boolean(active || voice?.starting || voice?.testing);
      $('#mic-input').disabled = Boolean(voice?.starting || voice?.testing);
      $('#voice-status').textContent = message;
      $('#preview-start').disabled = Boolean(active || voice?.starting || voice?.testing);
      if (active) endPreview();
    }, input: (level, message, warning) => {
      // The waveform is driven by measured input, not a decorative animation.
      // Open the otherwise compact microphone disclosure when action is needed.
      $('.voice-art').style.setProperty('--mic-level', String(level));
      if ($('#mic-status').textContent !== message) $('#mic-status').textContent = message;
      if (warning) $('#mic-controls').open = true;
    }, devices: (inputs, selected) => {
      // Show the device actually in use when listed; otherwise select the System
      // default option. Updating this dropdown alone does not switch capture.
      const current = selected || $('#mic-input').value;
      $('#mic-input').replaceChildren(new Option('System default', ''), ...inputs.map(d => new Option(d.label, d.id)));
      $('#mic-input').value = [...$('#mic-input').options].some(o => o.value === current) ? current : '';
    }});
    // Discovery is best-effort before permission. Test mic shares capture code
    // with a conversation but stops before obtaining any provider token.
    await voice.listInputs();
    $('#mic-input').onchange = () => voice.changeInput($('#mic-input').value);
    $('#mic-test').onclick = () => voice.start($('#mic-input').value, true);
    $('#voice-status').textContent = data.voiceConfigured ? 'Ready when you are.' : 'Voice setup pending';
    $('#voice-start').onclick = async () => {
      if (voice.active) { voice.stop(); return; }
      if (!data.voiceConfigured) { notice('Live conversation is unavailable. Try the guided preview.'); return; }
      endPreview();
      $('#voice-start').disabled = true; $('#voice-status').textContent = 'Connecting…'; $('#transcript').replaceChildren();
      await voice.start($('#mic-input').value);
    };
    $('#voice-start').disabled = false; $('#mic-test').disabled = false; $('#mic-input').disabled = false;
    $('#preview-start').disabled = false;
  } catch(e) { $('#films').innerHTML = '<div class="empty"><h3>The programme is unavailable.</h3><p>Refresh the page to try again.</p></div>'; $('#voice-status').textContent = 'Box office unavailable.'; notice(e.message); }
}
// Navigation must release capture and close the voice socket, not leave the
// microphone running after the visitor leaves this page.
window.addEventListener('pagehide', () => voice?.stop());
init();
