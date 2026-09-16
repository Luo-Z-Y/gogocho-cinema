/**
 * HTTP boundary for the local fictional cinema.
 *
 * This module serves the browser, owns cookie-scoped review state and exchanges
 * the private provider key for temporary voice tokens. Cinema calculations live
 * in cinema/service.js; conversational instructions live in voice/agent.js.
 * The origin, memory and rate-limit guards below are for a local prototype, not
 * a substitute for authentication or durable abuse controls on a public server.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { programme, searchScreenings, prepareBooking, confirmBooking } from './cinema/service.js';
import { agentConfig } from './voice/agent.js';

// Map browser URLs to known files rather than treating the repository as a
// static directory. New frontend assets need an explicit entry here; backend
// source, the catalogue file and credentials must never become static routes.
const files = {
  '/': ['index.html', 'text/html'],
  '/style.css': ['style.css', 'text/css'],
  '/app.js': ['app.js', 'text/javascript'],
  '/voice/client.js': ['voice/client.js', 'text/javascript'],
  '/voice/pcm-worklet.js': ['voice/pcm-worklet.js', 'text/javascript'],
  '/assets/favicon.svg': ['assets/favicon.svg', 'image/svg+xml']
};

/**
 * Build, but do not listen on, a server. Tests inject a clock, an empty/dummy
 * key and a simulated provider fetch so no real service or credential is needed.
 * Callers choose the listening port; the command-line entry point is below.
 */
export function createServer({ apiKey = process.env.ASSEMBLYAI_API_KEY || '', fetchProvider = fetch, now = () => new Date() } = {}) {
  // Each opaque cookie identifies a two-hour browser session and its latest
  // review. Tabs sharing the cookie share this state; a restart discards it.
  const sessions = new Map();
  // This counter measures start attempts, including failed provider exchanges,
  // across the whole process. It is deliberately not a per-customer quota.
  let tokenWindow = 0, tokensIssued = 0;
  return http.createServer(async (req, res) => {
    // Apply headers to successes and failures alike. Inline styles are needed
    // for catalogue poster colours; inline scripts are not permitted. The only
    // external browser connection allowed here is the provider's voice socket.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://agents.assemblyai.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Permissions-Policy', 'microphone=(self)');
    // A single response helper keeps API errors and successful results in the
    // JSON shape expected by frontend/app.js's post() wrapper.
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      // Check the host before using it as the base URL. Static assets are read
      // relative to this module, so their paths do not depend on the shell cwd.
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return json(403, { error: 'Local access only.' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && files[url.pathname]) {
        const [file, type] = files[url.pathname];
        const content = await readFile(new URL(`../frontend/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        return res.end(content);
      }
      // Unknown filesystem-looking paths stop here; only /api/* proceeds to
      // session handling. Fetching a stylesheet should not create a review cookie.
      if (!url.pathname.startsWith('/api/')) return json(404, { error: 'Not found.' });
      if (!['GET', 'POST'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
      // Mutation/token requests must originate from this exact local origin,
      // including its port. This complements SameSite cookies; it is not login.
      if (req.method === 'POST' && req.headers.origin !== `http://${req.headers.host}`) return json(403, { error: 'Use the cinema page to perform this action.' });
      // Use one clock reading throughout a request so schedule, expiry and
      // quota checks agree even if real time crosses a boundary mid-request.
      const time = now();
      for (const [id, s] of sessions) if (s.expires < time.getTime()) sessions.delete(id);
      // Reuse a cookie only when its ID still exists in our map. Missing/unknown
      // IDs get a fresh session rather than a default visitor's review. The cookie
      // is bearer session state, not authenticated proof of a visitor's identity.
      let sid = (req.headers.cookie || '').match(/(?:^|;\s*)gogocho=([a-f0-9-]+)/)?.[1];
      if (!sessions.has(sid)) {
        if (sessions.size >= 1000) return json(429, { error: 'Too many local sessions.' });
        sid = randomUUID(); sessions.set(sid, { expires: time.getTime() + 2 * 3600000, quote: null });
        res.setHeader('Set-Cookie', `gogocho=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200`);
      }
      // HttpOnly hides the cookie from page JavaScript; same-origin fetch sends
      // it automatically. Return only a configuration flag, never the API key.
      const state = sessions.get(sid);
      if (req.method === 'GET' && url.pathname === '/api/programme') return json(200, { ...programme(time), voiceConfigured: Boolean(apiKey) });
      if (req.method !== 'POST') return json(404, { error: 'Not found.' });
      // Count incoming bytes before parsing to bound body allocation. Reject
      // malformed JSON, arrays and null here; each cinema function validates
      // its own arguments after this common request-envelope check.
      let body = '', bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 8192) return json(413, { error: 'Request too large.' }); body += chunk; }
      let input;
      try { input = JSON.parse(body || '{}'); } catch { return json(400, { error: 'Invalid JSON.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json(400, { error: 'Expected an object.' });
      // Explicit dispatch is the server-side tool allowlist, not dynamic code
      // execution. A new review replaces the old one only after validation;
      // there is intentionally no confirm_booking tool for the agent to call.
      if (url.pathname === '/api/tool') {
        if (input.name === 'search_screenings') return json(200, searchScreenings(input.arguments, time));
        if (input.name === 'prepare_booking') { state.quote = prepareBooking(input.arguments, time); return json(200, state.quote); }
        return json(400, { error: 'Unknown cinema tool.' });
      }
      // The page calls this separate route after the visitor's confirmation
      // action. Validate against the cookie's current review, not a client-sent
      // price, quantity or screening object. Retries use the same demo reference.
      if (url.pathname === '/api/confirm') {
        const result = confirmBooking(state.quote, input.quoteId, time);
        return json(200, result); // The quote ID yields the same demo reference on retries.
      }
      // Voice setup is optional: the programme and demo reviews work without
      // a key. Keep attempt limits in front of the potentially chargeable API.
      if (url.pathname === '/api/voice-session') {
        if (!apiKey) return json(503, { error: 'Voice is not configured yet. You can still explore the programme and try a demo booking.' });
        if (time.getTime() - tokenWindow > 3600000) { tokenWindow = time.getTime(); tokensIssued = 0; }
        if (tokensIssued >= 5) return json(429, { error: 'Five voice starts per hour are allowed in this local prototype. Try again later.' });
        tokensIssued++;
        try {
          // The permanent key is used only on this server-to-provider request.
          // An unused token expires in 60 seconds; a started session is capped
          // at 600 seconds. The 12-second HTTP timeout is a separate safeguard.
          const r = await fetchProvider('https://agents.assemblyai.com/v1/token?expires_in_seconds=60&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(12000) });
          // Do not relay raw provider errors, which may contain account details.
          // Only a valid temporary token and non-secret agent configuration are
          // returned to the browser; neither requires exposing the server key.
          if (!r.ok) return json(502, { error: 'AssemblyAI could not start a session. Check your API key, credits and Voice Agent API access.' });
          const data = await r.json();
          if (typeof data.token !== 'string' || !data.token) throw new Error('Missing token');
          return json(200, { token: data.token, config: agentConfig(time) });
        } catch { return json(502, { error: 'The voice service is unavailable. Please try again.' }); }
      }
      return json(404, { error: 'Not found.' });
    } catch (error) { json(400, { error: error.message || 'Unable to complete this request.' }); }
  });
}

// Importing createServer in tests must not claim a port or load .env itself.
// npm start/dev loads the root .env through Node's command-line flag and reaches
// this branch. Bind only to loopback until public-access safeguards are added.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => console.log(`Gogocho Cinema: http://127.0.0.1:${port}`));
  server.on('error', error => { console.error(`Could not start cinema: ${error.code}`); process.exitCode = 1; });
}
