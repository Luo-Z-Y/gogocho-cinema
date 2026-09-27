/** Cross-instance state is required for a serverless demo: a cold start must not
 * lose a review, while editing its signed price/quantity must invalidate it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSession, decodeSession, newSession } from '../../backend/session.js';
import { prepareBooking } from '../../backend/cinema/service.js';
import { createServer } from '../../backend/server.js';
const key = 'unit-test-signing-key-only-not-a-credential';
const now = new Date('2026-09-27T03:00:00Z');
test('signed review survives serialisation, rejects tampering and expires', () => {
  const state = newSession(now);
  state.quote = prepareBooking({ screeningId: '2026-09-28_last-table', quantity: 2 }, now);
  const cookie = encodeSession(state, key);
  assert.ok(cookie.length < 3800, 'review fits a browser cookie');
  assert.deepEqual(decodeSession(cookie, key, now), state);
  const [payload, signature] = cookie.split('.');
  const changed = JSON.parse(Buffer.from(payload, 'base64url')); changed.quote.totalCents = 1;
  assert.equal(decodeSession(`${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`, key, now), null);
  assert.equal(decodeSession(cookie, key, new Date(state.expires)), null);
  assert.equal(decodeSession(cookie, 'wrong-key', now), null);
});
test('separate server instances can confirm a signed review without shared memory', async t => {
  const servers = [1, 2].map(() => createServer({ apiKey: '', signingKey: key, now: () => now }));
  const urls = [];
  for (const server of servers) {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    urls.push(`http://127.0.0.1:${server.address().port}`);
  }
  const post = (url, path, body, cookie = '') => fetch(url + path, { method: 'POST', headers: { origin: url, 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
  const response = await post(urls[0], '/api/tool', { name: 'prepare_booking', arguments: { screeningId: '2026-09-28_last-table', quantity: 2 } });
  const quote = await response.json();
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const confirmed = await post(urls[1], '/api/confirm', { quoteId: quote.id }, cookie);
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).status, 'confirmed_demo');
  assert.equal((await post(urls[1], '/api/confirm', { quoteId: quote.id })).status, 400);
});
test('public configuration fails closed without HTTPS or a strong signing key', () => {
  assert.throws(() => createServer({ publicOrigin: 'http://demo.example', signingKey: key }), /HTTPS/);
  assert.throws(() => createServer({ publicOrigin: 'https://demo.example', signingKey: '' }), /signing key/);
});
