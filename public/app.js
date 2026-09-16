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
    return `<article class="film"><div class="poster" style="--film:${f.colour};--ink:${f.ink}"><span class="poster-index" aria-hidden="true">${f.mark}</span><h3 class="poster-title">${escape(f.title)}</h3></div><div class="film-info"><p class="film-meta">${escape(f.genre)} · ${f.runtime} min</p><button class="screening" data-screening="${escape(s.id)}" aria-label="Select ${escape(f.title)} at ${s.startTime}">${s.startTime}<span>Ends ${s.endTime}</span></button></div><details class="film-details"><summary aria-label="Details about ${escape(f.title)}">Details</summary><p>${escape(f.description)}</p><p>${escape(f.language)} · Screen ${s.screen}</p><p>${escape(f.audience)}. ${escape(f.contentNotes)}</p></details></article>`;
  }).join('') : '<div class="empty"><h3>No matching films</h3><p>Try another day or change a filter.</p></div>';
}
async function search() {
  const version = ++searchVersion;
  try { const result = await post('/api/tool', { name: 'search_screenings', arguments: filters() }); if (version === searchVersion) renderFilms(result.results); }
  catch (e) { if (version === searchVersion) notice(e.message); }
}
function showQuote(value) {
  quote = value;
  $('#booking-heading').textContent = 'Review booking';
  $('#booking-details').innerHTML = `<h3>${escape(value.film.title)}</h3><div class="booking-row"><span>Screening</span><span>${escape(dateLabel(value.screening.date))}, ${value.screening.startTime}</span></div><div class="booking-row"><span>Screen ${value.screening.screen}</span><span>Ends ${value.screening.endTime} SGT</span></div><div class="booking-row"><span>Demo total · ${value.quantity} ticket${value.quantity === 1 ? '' : 's'}</span><strong>${currency(value.totalCents)}</strong></div>`;
  $('#quantity').value = value.quantity;
  $('#quantity').disabled = false;
  $('#booking-form').hidden = false;
  $('#confirm').disabled = false;
  $('#booking-message').textContent = '';
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
    $('#booking-heading').textContent = 'Demo confirmed';
    $('#booking-form').hidden = true;
    $('#booking-message').textContent = result.reference;
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
      $('#voice-start').textContent = active ? 'End conversation' : 'Start talking ↗';
      $('#voice-start').disabled = Boolean(voice?.starting || voice?.testing);
      $('#mic-test').disabled = Boolean(active || voice?.starting || voice?.testing);
      $('#mic-input').disabled = Boolean(voice?.starting || voice?.testing);
      $('#voice-status').textContent = message;
      $('#chat').hidden = !active;
    }, input: (level, message, warning) => {
      $('.voice-art').style.setProperty('--mic-level', String(level));
      if ($('#mic-status').textContent !== message) $('#mic-status').textContent = message;
      if (warning) $('#mic-controls').open = true;
    }, devices: (inputs, selected) => {
      const current = selected || $('#mic-input').value;
      $('#mic-input').replaceChildren(new Option('System default', ''), ...inputs.map(d => new Option(d.label, d.id)));
      $('#mic-input').value = [...$('#mic-input').options].some(o => o.value === current) ? current : '';
    }});
    await voice.listInputs();
    $('#mic-input').onchange = () => voice.changeInput($('#mic-input').value);
    $('#mic-test').onclick = () => voice.start($('#mic-input').value, true);
    $('#voice-status').textContent = data.voiceConfigured ? 'Ready when you are.' : 'Voice setup pending';
    $('#voice-start').onclick = async () => {
      if (voice.active) { voice.stop(); return; }
      if (!data.voiceConfigured) { notice('Add ASSEMBLYAI_API_KEY to the project’s local .env file and restart the server to enable voice.'); return; }
      $('#voice-start').disabled = true; $('#voice-status').textContent = 'Connecting…'; $('#transcript').replaceChildren();
      await voice.start($('#mic-input').value);
    };
    $('#voice-start').disabled = false; $('#mic-test').disabled = false; $('#mic-input').disabled = false;
    $('#chat').onsubmit = e => { e.preventDefault(); const text = $('#message').value.trim(); if (text) { voice.text(text); $('#message').value = ''; } };
  } catch(e) { $('#films').innerHTML = '<div class="empty"><h3>The programme is unavailable.</h3><p>Refresh the page to try again.</p></div>'; $('#voice-status').textContent = 'Box office unavailable.'; notice(e.message); }
}
window.addEventListener('pagehide', () => voice?.stop());
init();
