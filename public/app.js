import { VoiceBoxOffice } from './voice.js';
const $ = s => document.querySelector(s);
const form = $('#filters');
const booking = $('#booking');
let data, quote, searchVersion = 0, quoteVersion = 0, voice;
const currency = n => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n / 100);
const dateLabel = date => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00+08:00`));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function notice(message) { $('#notice').textContent = message; $('#notice').hidden = false; clearTimeout(notice.timer); notice.timer = setTimeout(() => $('#notice').hidden = true, 6500); }
async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || 'Please try again.');
  return value;
}
function filters() {
  const values = Object.fromEntries(new FormData(form));
  return Object.fromEntries(Object.entries(values).filter(([,v]) => v !== '').map(([k,v]) => [k, k === 'maxRuntime' ? Number(v) : v]));
}
function renderFilms(results) {
  $('#film-count').textContent = `${results.length} screening${results.length === 1 ? '' : 's'}`;
  $('#films').innerHTML = results.length ? results.map(s => {
    const f = s.film;
    return `<article class="film"><div class="poster" style="--film:${f.colour};--ink:${f.ink}" aria-hidden="true"><div class="poster-top"><span>GOGOCHO ORIGINALS</span><span>${f.mark} / 08</span></div><div class="poster-title">${escape(f.title)}</div><span class="poster-number">${f.mark}</span><div class="poster-bottom">${escape(f.genre.toUpperCase())} · ${f.runtime} MIN</div></div><p class="film-meta">${escape(f.genre)} · ${f.runtime} min · ${escape(f.language)}</p><h3>${escape(f.title)}</h3><p class="film-desc">${escape(f.description)}</p><div class="screenings"><button class="screening" data-screening="${escape(s.id)}" aria-label="Select ${escape(f.title)} at ${s.startTime}">${s.startTime}<span>Ends ${s.endTime} · Screen ${s.screen}</span></button></div><details class="content-notes"><summary>Audience & content notes</summary><p>${escape(f.audience)}. ${escape(f.contentNotes)}</p></details></article>`;
  }).join('') : '<div class="empty"><h3>A different evening, perhaps?</h3><p>No future screenings match these choices.<br>Try another day, mood or finish time.</p></div>';
}
async function search() {
  const version = ++searchVersion;
  try { const result = await post('/api/tool', { name: 'search_screenings', arguments: filters() }); if (version === searchVersion) renderFilms(result.results); }
  catch (e) { if (version === searchVersion) notice(e.message); }
}
function showQuote(value) {
  quote = value;
  $('#booking-heading').textContent = 'Make an evening of it.';
  $('#booking-details').innerHTML = `<h3>${escape(value.film.title)}</h3><div class="booking-row"><span>Screening</span><span>${escape(dateLabel(value.screening.date))}, ${value.screening.startTime}</span></div><div class="booking-row"><span>Screen ${value.screening.screen}</span><span>Ends ${value.screening.endTime} SGT</span></div><div class="booking-row"><span>Demo total · ${value.quantity} ticket${value.quantity === 1 ? '' : 's'}</span><strong>${currency(value.totalCents)}</strong></div>`;
  $('#quantity').value = value.quantity;
  $('#quantity').disabled = false;
  $('#booking-form').hidden = false;
  $('#confirm').disabled = false;
  $('#booking-message').textContent = 'Review these details before confirming your simulated booking.';
  if (!booking.open) booking.showModal();
}
async function prepare(screeningId, quantity) {
  const version = ++quoteVersion;
  $('#confirm').disabled = true;
  try { const result = await post('/api/tool', { name: 'prepare_booking', arguments: { screeningId, quantity } }); if (version === quoteVersion) showQuote(result); }
  catch(e) { if (version === quoteVersion) { $('#booking-message').textContent = e.message; notice(e.message); } }
}
$('#films').addEventListener('click', e => { const button = e.target.closest('[data-screening]'); if (button) prepare(button.dataset.screening, 2); });
form.addEventListener('submit', e => { e.preventDefault(); search(); });
$('#reset').onclick = () => { form.reset(); form.elements.date.value = data.today; search(); };
$('#close-booking').onclick = () => booking.close();
$('#quantity').onchange = () => { if (quote) prepare(quote.screening.id, Number($('#quantity').value)); };
$('#booking-form').onsubmit = async e => {
  e.preventDefault(); if (!quote) return;
  $('#confirm').disabled = true; $('#quantity').disabled = true;
  try {
    const result = await post('/api/confirm', { quoteId: quote.id });
    $('#booking-heading').textContent = 'Your imaginary evening is set.';
    $('#booking-form').hidden = true;
    $('#booking-message').textContent = `${result.reference} · ${result.notice}`;
    voice?.context(`The visitor explicitly pressed Confirm demo booking. Result: ${JSON.stringify(result)}`);
  } catch(e) { $('#booking-message').textContent = e.message; $('#quantity').disabled = false; $('#confirm').disabled = false; }
};

async function runTool(name, args) {
  const result = await post('/api/tool', { name, arguments: args });
  if (name === 'search_screenings') {
    ++searchVersion;
    form.reset();
    for (const [key,value] of Object.entries(args)) if (form.elements[key]) form.elements[key].value = String(value);
    renderFilms(result.results);
  } else if (name === 'prepare_booking') { ++quoteVersion; showQuote(result); }
  return result;
}
function transcript(role, text, id) {
  let line = [...$('#transcript').children].find(el => el.dataset.id === id);
  if (!line) { line = document.createElement('p'); line.className = 'utterance'; line.dataset.id = id; const label = document.createElement('strong'); label.textContent = role === 'user' ? 'You' : 'Box office'; line.append(label, document.createElement('span')); $('#transcript').append(line); }
  line.lastChild.textContent = text;
  while ($('#transcript').children.length > 100) $('#transcript').firstChild.remove();
  $('#transcript').scrollTop = $('#transcript').scrollHeight;
}
async function init() {
  try {
    const r = await fetch('/api/programme'); if (!r.ok) throw new Error('The programme could not be loaded.'); data = await r.json();
    $('#date').innerHTML = data.dates.map((d,i) => `<option value="${d}">${i === 0 ? 'Today · ' : i === 1 ? 'Tomorrow · ' : ''}${dateLabel(d)}</option>`).join('');
    await search();
    voice = new VoiceBoxOffice({ post, runTool, transcript, state: (active, message) => {
      $('.box-office').classList.toggle('live', active);
      $('#voice-start').textContent = active ? 'End conversation' : 'Talk to the box office ↗';
      $('#voice-start').disabled = false;
      $('#voice-status').textContent = message;
      $('#chat').hidden = !active;
    }});
    $('#voice-status').textContent = data.voiceConfigured ? 'Ready when you are. Microphone permission is needed.' : 'Voice setup pending. Explore the programme and try a demo booking below.';
    $('#voice-start').onclick = async () => {
      if (voice.active) { voice.stop(); return; }
      if (!data.voiceConfigured) { notice('Add ASSEMBLYAI_API_KEY to the project’s local .env file and restart the server to enable voice.'); return; }
      $('#voice-start').disabled = true; $('#voice-status').textContent = 'Connecting to the box office…'; $('#transcript').replaceChildren();
      await voice.start();
    };
    $('#chat').onsubmit = e => { e.preventDefault(); const text = $('#message').value.trim(); if (text) { voice.text(text); $('#message').value = ''; } };
  } catch(e) { $('#films').innerHTML = '<div class="empty"><h3>The programme is unavailable.</h3><p>Refresh the page to try again.</p></div>'; $('#voice-status').textContent = 'Box office unavailable.'; notice(e.message); }
}
window.addEventListener('pagehide', () => voice?.stop());
init();
