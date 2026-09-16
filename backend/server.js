import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { programme, searchScreenings, prepareBooking, confirmBooking } from './cinema/service.js';
import { agentConfig } from './voice/agent.js';

// Only these frontend assets are public; never expose backend source or configuration.
const files = {
  '/': ['index.html', 'text/html'],
  '/style.css': ['style.css', 'text/css'],
  '/app.js': ['app.js', 'text/javascript'],
  '/voice/client.js': ['voice/client.js', 'text/javascript'],
  '/voice/pcm-worklet.js': ['voice/pcm-worklet.js', 'text/javascript'],
  '/assets/favicon.svg': ['assets/favicon.svg', 'image/svg+xml']
};

export function createServer({ apiKey = process.env.ASSEMBLYAI_API_KEY || '', fetchProvider = fetch, now = () => new Date() } = {}) {
  const sessions = new Map();
  let tokenWindow = 0, tokensIssued = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://agents.assemblyai.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Permissions-Policy', 'microphone=(self)');
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return json(403, { error: 'Local access only.' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && files[url.pathname]) {
        const [file, type] = files[url.pathname];
        const content = await readFile(new URL(`../frontend/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        return res.end(content);
      }
      if (!url.pathname.startsWith('/api/')) return json(404, { error: 'Not found.' });
      if (!['GET', 'POST'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
      // Mutations and token issuance are same-origin, even on the local development server.
      if (req.method === 'POST' && req.headers.origin !== `http://${req.headers.host}`) return json(403, { error: 'Use the cinema page to perform this action.' });
      const time = now();
      for (const [id, s] of sessions) if (s.expires < time.getTime()) sessions.delete(id);
      let sid = (req.headers.cookie || '').match(/(?:^|;\s*)gogocho=([a-f0-9-]+)/)?.[1];
      if (!sessions.has(sid)) {
        if (sessions.size >= 1000) return json(429, { error: 'Too many local sessions.' });
        sid = randomUUID(); sessions.set(sid, { expires: time.getTime() + 2 * 3600000, quote: null });
        res.setHeader('Set-Cookie', `gogocho=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200`);
      }
      const state = sessions.get(sid);
      if (req.method === 'GET' && url.pathname === '/api/programme') return json(200, { ...programme(time), voiceConfigured: Boolean(apiKey) });
      if (req.method !== 'POST') return json(404, { error: 'Not found.' });
      let body = '', bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 8192) return json(413, { error: 'Request too large.' }); body += chunk; }
      let input;
      try { input = JSON.parse(body || '{}'); } catch { return json(400, { error: 'Invalid JSON.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json(400, { error: 'Expected an object.' });
      if (url.pathname === '/api/tool') {
        if (input.name === 'search_screenings') return json(200, searchScreenings(input.arguments, time));
        if (input.name === 'prepare_booking') { state.quote = prepareBooking(input.arguments, time); return json(200, state.quote); }
        return json(400, { error: 'Unknown cinema tool.' });
      }
      if (url.pathname === '/api/confirm') {
        const result = confirmBooking(state.quote, input.quoteId, time);
        return json(200, result); // The quote ID yields the same demo reference on retries.
      }
      if (url.pathname === '/api/voice-session') {
        if (!apiKey) return json(503, { error: 'Voice is not configured yet. You can still explore the programme and try a demo booking.' });
        if (time.getTime() - tokenWindow > 3600000) { tokenWindow = time.getTime(); tokensIssued = 0; }
        if (tokensIssued >= 5) return json(429, { error: 'Five voice starts per hour are allowed in this local prototype. Try again later.' });
        tokensIssued++;
        try {
          const r = await fetchProvider('https://agents.assemblyai.com/v1/token?expires_in_seconds=60&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(12000) });
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => console.log(`Gogocho Cinema: http://127.0.0.1:${port}`));
  server.on('error', error => { console.error(`Could not start cinema: ${error.code}`); process.exitCode = 1; });
}
