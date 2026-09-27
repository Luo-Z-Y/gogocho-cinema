/** Signed, short-lived demo state for serverless instances. The cookie contains
 * only fictional booking data and quota counters, never a provider credential.
 * HMAC makes client edits detectable; it is not encryption or customer login.
 * An old valid cookie may be replayed until expiry, which is acceptable only for
 * this non-transactional demo. Real inventory would require durable storage. */
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
export function encodeSession(state, key) {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}
/** Invalid signatures, malformed payloads and expired sessions become a fresh
 * session. Constant-time comparison is used only after checking equal lengths. */
export function decodeSession(value, key, now = new Date()) {
  try {
    if (!value || value.length > 6000) return null;
    const [payload, signature, extra] = value.split('.');
    if (extra || !payload || !signature) return null;
    const expected = createHmac('sha256', key).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return state && typeof state.id === 'string' && state.expires > now.getTime() ? state : null;
  } catch { return null; }
}
export function newSession(now) {
  return { id: randomUUID(), expires: now.getTime() + 2 * 3600000, quote: null, voiceStarts: 0, voiceWindow: now.getTime() };
}
