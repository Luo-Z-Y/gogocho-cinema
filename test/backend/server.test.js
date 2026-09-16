/**
 * HTTP integration tests against isolated loopback servers on ephemeral ports.
 * Cinema functions and cookie handling are real; provider responses are injected
 * fixtures. Nothing here establishes live AssemblyAI access or microphone quality.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from '../../backend/server.js';
// Keep the daily programme and rate-limit window fixed regardless of wall time.
const now = () => new Date('2026-09-16T02:00:00Z');
/**
 * Give each test fresh sessions/quotas and no real API key by default. Port 0
 * avoids clashing with the user's app. Closing keep-alive connections in teardown
 * lets the Node test process exit instead of waiting for pooled fetch sockets.
 */
async function fixture(t, options = {}) {
  const server = createServer({ now, apiKey: '', ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  // Node fetch has no browser cookie jar: tests explicitly choose the cookie and
  // Origin header so isolation/rejection cases are visible in each assertion.
  const post = (path, body = {}, cookie = '', origin = url) => fetch(url + path, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { url, post };
}
// Guard the source-layout/URL contract. Serving the correct file and MIME type
// is necessary for native ES modules and AudioWorklets, not just for the HTML.
test('frontend entry point, module imports, styles, icon and worklet resolve', async t => {
  const { url } = await fixture(t);
  const assets = [
    ['/', 'index.html', 'text/html'],
    ['/style.css', 'style.css', 'text/css'],
    ['/app.js', 'app.js', 'text/javascript'],
    ['/voice/client.js', 'voice/client.js', 'text/javascript'],
    ['/voice/pcm-worklet.js', 'voice/pcm-worklet.js', 'text/javascript'],
    ['/assets/favicon.svg', 'assets/favicon.svg', 'image/svg+xml']
  ];
  const contents = new Map();
  for (const [path, file, type] of assets) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), `${type}; charset=utf-8`, path);
    const content = await response.text();
    assert.equal(content, await readFile(new URL(`../../frontend/${file}`, import.meta.url), 'utf8'), path);
    contents.set(path, content);
  }
  // Check the links/imports as well as isolated routes: a valid module URL does
  // not help if the page or voice client still points at a retired location.
  assert.match(contents.get('/'), /type="module" src="\/app\.js"/);
  assert.match(contents.get('/'), /href="\/style\.css"/);
  assert.match(contents.get('/'), /href="\/assets\/favicon\.svg"/);
  assert.match(contents.get('/app.js'), /from '\.\/voice\/client\.js'/);
  assert.match(contents.get('/voice/client.js'), /new URL\('\.\/pcm-worklet\.js', import\.meta\.url\)/);
});
// Directory names do not enforce privacy; the server's explicit allowlist does.
// Probe backend/configuration paths and old URLs, then exercise mutation-origin,
// missing-key and unknown-tool guards without contacting a provider.
test('missing key, origin isolation, and private files fail safely', async t => {
  const { url, post } = await fixture(t);
  for (const path of [
    '/.env', '/.env.example', '/package.json', '/README.md',
    '/backend/server.js', '/backend/cinema/service.js', '/backend/cinema/films.json', '/backend/voice/agent.js',
    '/frontend/index.html', '/test/backend/server.test.js', '/scripts/check.js',
    '/server.js', '/lib/cinema.js', '/data/films.json', '/public/app.js', '/voice.js', '/pcm-worklet.js'
  ]) assert.equal((await fetch(url + path)).status, 404, path);
  assert.equal((await post('/api/tool', {}, '', 'https://unrelated.example')).status, 403);
  const p = await (await fetch(url + '/api/programme')).json();
  assert.equal(p.voiceConfigured, false);
  assert.equal((await post('/api/voice-session')).status, 503);
  assert.equal((await post('/api/tool', { name: 'confirm_booking' })).status, 400);
});
// A quote ID by itself is insufficient: confirmation needs the originating
// browser's current review. Re-preparing a quantity replaces that review, making
// an older tab's ID stale even when both tabs would share the same cookie.
test('demo booking is scoped to the browser cookie and latest review', async t => {
  const { post } = await fixture(t);
  const args = { name: 'prepare_booking', arguments: { screeningId: '2026-09-16_last-table', quantity: 2 } };
  const response = await post('/api/tool', args);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const quote = await response.json();
  assert.equal((await post('/api/confirm', { quoteId: quote.id })).status, 400);
  const confirmed = await (await post('/api/confirm', { quoteId: quote.id }, cookie)).json();
  assert.equal(confirmed.status, 'confirmed_demo');
  await post('/api/tool', { ...args, arguments: { ...args.arguments, quantity: 3 } }, cookie);
  assert.equal((await post('/api/confirm', { quoteId: quote.id }, cookie)).status, 400);
});
// The key/token strings below are test fixtures, not credentials. Inspect the
// outbound exchange request and inbound browser JSON on opposite sides of the
// security boundary, then prove the sixth start attempt is rejected locally.
test('server exchanges a key for a capped temporary token without exposing the key', async t => {
  const { post } = await fixture(t, { apiKey: 'test-private-key', fetchProvider: async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer test-private-key');
    assert.equal(new URL(url).searchParams.get('max_session_duration_seconds'), '600');
    return Response.json({ token: 'test-temporary-token' });
  } });
  const r = await post('/api/voice-session');
  const body = await r.text();
  assert.ok(!body.includes('test-private-key'));
  const value = JSON.parse(body);
  assert.equal(value.token, 'test-temporary-token');
  assert.ok(value.config.tools.every(tool => tool.execution_mode === 'hold'));
  for (let i = 0; i < 4; i++) assert.equal((await post('/api/voice-session')).status, 200);
  assert.equal((await post('/api/voice-session')).status, 429);
});
// A failed upstream exchange must produce an application-owned message, not
// relay a provider response body that might contain account or request details.
test('provider errors are redacted', async t => {
  const { post } = await fixture(t, { apiKey: 'secret', fetchProvider: async () => new Response('sensitive provider detail', { status: 401 }) });
  const response = await post('/api/voice-session');
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('sensitive'));
});
