# Gogocho Cinema

A conversational box office for a fictional independent cinema. Tell it your mood and available time, compare two films on screen, then review and explicitly confirm a demo booking.

**[Open the cinema](https://gogocho-cinema.vercel.app)** · [Source](https://github.com/Luo-Z-Y/gogocho-cinema) · [Submitted entry](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/gogocho/gogocho-cinema)

Submitted on 27 September 2026 to the AssemblyAI Voice Agent Hackathon. Built as a solo entry by Zhiyang, with AI assistance. All eight films, screening times, prices and bookings are fictional. No payment is taken and no seats are reserved.

## Try it

Press **Start talking**, allow your microphone, and say:

> Something light tomorrow, under two hours, finishing before ten at night.

Then ask to compare **Sideways Summer** and **The Last Table**, keeping those preferences. Ask for two tickets for The Last Table. The agent opens a review; only your **Confirm demo booking** click finalises it. The receipt can be saved to a calendar and retains its demo status.

**Try a preview** runs a clearly labelled scripted walkthrough without a microphone or provider session. Manual filters, comparison and booking also work independently of voice. The preview uses the real cinema APIs; it is not an AI conversation.

If your voice is not detected, open **Microphone**, select your intended input and use **Test mic**. This six-second input test sends no audio to AssemblyAI and releases the microphone afterwards.

## Run locally

Requires Node.js **22.x**. There are no npm dependencies.

```sh
cp .env.example .env
# Optionally add your AssemblyAI API key to .env, then:
npm start
```

Open http://127.0.0.1:3000. The programme and demo bookings work without a key. `npm run dev` watches backend changes. Refresh after changing frontend files. Keep keys out of screenshots, chat and Git.

## What is implemented

- Eight original films with illustrated SVG posters, spoiler-free descriptions and editorial content notes.
- A rolling seven-day programme across two screens, using Singapore time.
- Mood, date, runtime and strict finish-before constraints. **Any time** removes the cutoff without changing other preferences. Past screenings are excluded.
- Manual or voice-driven comparison of two films. Unavailable films keep their facts but have no bookable screening; comparison never silently relaxes constraints.
- AssemblyAI speech recognition, conversational reasoning, streamed spoken replies, transcripts and tool calls.
- Visible listening/thinking/speaking status, microphone selection, input-level feedback and local mic testing.
- One to six simulated S$12 tickets, ten-minute reviews, explicit confirmation and calendar export with a demo notice.
- A minimal responsive interface with keyboard-operable controls, native dialogues and reduced-motion support.

Live typed follow-ups were inconsistent during release testing, so typed-input controls are **not exposed** in the public demo. The transport retains injectable text/context methods for testing and application updates; these are not a supported chat interface.

## Architecture

```text
frontend/app.js -- /api/* --> backend/server.js
       |                         |-- cinema/service.js --> cinema/films.json
       |                         |-- voice/agent.js
       |                         `-- session.js
       v
frontend/voice/client.js <--> AssemblyAI Voice Agent API
       `-- pcm-worklet.js
```

1. The server exchanges its private AssemblyAI key for a single-use, short-lived voice token.
2. The browser streams 24 kHz mono PCM16 audio directly to AssemblyAI. An AudioWorklet resamples the microphone's native rate. AssemblyAI transcribes, reasons and streams spoken replies.
3. The agent requests `search_screenings`, `compare_films` or `prepare_booking`. The browser calls the same validated API used by the manual interface. Tool results update the screen and return to the agent.
4. Hold-mode results wait for `reply.done` and HTTP completion before resuming the agent. Interrupted or ended sessions discard late results. `session.end` releases audio capture and playback.
5. The visitor confirms through a separate endpoint. There is no agent confirmation tool. Server code validates the latest review and its expiry, regardless of what the model says.

| Route | Purpose |
| --- | --- |
| `GET /api/programme` | Original catalogue, future screenings and voice configuration status |
| `POST /api/tool` | Search, compare or prepare a review through an explicit allowlist |
| `POST /api/confirm` | Confirm the current unexpired demo review |
| `POST /api/voice-session` | Temporary token and non-secret agent configuration |

## Source map

| Path | Responsibility |
| --- | --- |
| `frontend/index.html`, `style.css` | Semantic shell, minimal layout and responsive styles |
| `frontend/app.js` | Filtering, comparison, guided preview, reviews and voice/UI callbacks |
| `frontend/booking.js` | Calendar export of a confirmed demo ticket |
| `frontend/assets/` | Original favicon and eight SVG poster illustrations |
| `frontend/voice/client.js` | WebSocket, microphone, playback, transcript and tool lifecycle |
| `frontend/voice/pcm-worklet.js` | Audio-thread conversion to 24 kHz PCM16 |
| `backend/server.js` | HTTP, explicit static routes, origin checks, cookies and token exchange |
| `backend/session.js` | Signed two-hour demo state for deployment across server instances |
| `backend/cinema/service.js` | Programme, strict constraints, comparison, totals and confirmation |
| `backend/cinema/films.json` | Original catalogue and daily screening slots |
| `backend/voice/agent.js` | Agent brief, greeting and tool schemas |
| `server.js` | Thin Vercel Node entry point |
| `test/frontend/`, `test/backend/` | Automated checks with simulated provider/audio fixtures |
| `scripts/check.js` | JavaScript syntax and catalogue consistency |
| `docs/` | Progress, demo rehearsal and submission record |

Only explicit frontend routes are served. `.env`, backend source, tests and repository configuration are not web assets. A new cinema tool requires a schema, a validated backend implementation, server/client allowlist entries and UI rendering. Prompt instructions never replace server validation.

## Deployment and limits

The public HTTPS demo runs on Vercel. `vercel.json` selects the build check, includes runtime assets and caps function duration at 30 seconds. Root `server.js` starts the native Node server; the local entry remains bound to loopback.

- `ASSEMBLYAI_API_KEY`: sensitive server-side environment variable, never sent to the browser.
- `DEMO_SIGNING_KEY`: private random signing key, at least 32 characters. Required for public hosting.
- `PUBLIC_ORIGIN`: optional explicit HTTPS origin. Vercel's production URL supplies the default.
- `PORT`: optional local listening port, default 3000.

Public voice sessions last at most **three minutes**. Unused tokens expire after one minute. A published Vercel WAF rule limits `/api/voice-session` to **three requests per IP per ten minutes**. Signed browser state also limits starts to three per hour. The process-wide five-starts-per-hour limit is an additional backstop, not a durable global quota. Local voice sessions can last ten minutes.

Public cookies contain signed, unencrypted fictional review state and expiry; they survive cold starts. This is not authentication, a customer database or real ticket inventory. A visitor can reset a cookie, and a previously issued signed cookie can be replayed until expiry. The edge rule provides a separate IP limit. These controls do not establish a hard account-wide spending cap. Production ticketing would require durable inventory, stronger abuse controls and payments.

Starting voice sends microphone audio to AssemblyAI. Transcripts stay in page memory and clear on reload/new conversation. The app does not store recordings. AssemblyAI processing and retention follow its own settings and terms. Available credits and retention settings have not been independently audited.

## Verification

```sh
npm test
npm run check
```

On **27 September 2026**, all **26 automated tests** and syntax/catalogue checks passed. These cover strict timing, invalid arguments, comparison, reviews, cookie isolation/tampering/expiry, cross-instance state, token handling, hold-result ordering, audio resampling and calendar content.

A separate **live AssemblyAI test with computer-generated speech** recognised three spoken requests, preserved date/mood/runtime/cutoff, called all three cinema tools, prepared two tickets for The Last Table on 28 September at 17:00 (ends 18:36), and produced a confirmed demo reference after a separate confirmation request. This exercises real speech recognition and reasoning but is not a human microphone/noise test.

The public browser guided journey also passed discovery, comparison, review and an explicit confirmation click. Calendar generation is unit-tested; the in-app browser's download observer timed out, so a completed browser download is not claimed. Real AirPods use was user-confirmed on 16 September. Fresh interruption/noisy-room, Safari and Firefox checks remain outstanding.

See [the detailed progress log](docs/PROGRESS.md), [rehearsal guide](docs/DEMO.md) and [submission record](docs/SUBMISSION.md).

## Code comments and catalogue data

Comments explain module responsibilities, contracts, validation and asynchronous lifecycle. Strict JSON cannot contain comments; catalogue and deployment fields are documented here instead.

### Catalogue fields

Each object in `backend/cinema/films.json` describes one original fictional film and its daily slot. The cinema service expands that slot across future dates; it is not a real listing or seat inventory.

| Fields | Meaning |
| --- | --- |
| `id` | Stable film identifier used in tool arguments; a screening ID combines its date with this ID. Keep IDs unique. |
| `title`, `tagline` | Original display/conversation copy. The current film cards show the title, not a second tagline. |
| `genre`, `mood` | Human-readable genre and filter category. Supported moods are `light`, `gentle`, `wonder` and `tense`. |
| `runtime` | Whole minutes; the catalogue check requires a positive value below 180. End times are calculated in code. |
| `time`, `screen` | Daily Singapore `HH:MM` start and screen 1 or 2. Cinema tests check that slots on a screen do not overlap. |
| `language` | Original language description, not external film metadata. |
| `description`, `conversation` | Short visitor-facing synopsis and additional spoiler-free guidance for the agent. |
| `audience`, `contentNotes` | Editorial suitability/content guidance, not official age ratings. |
| `colour`, `ink`, `mark` | Hexadecimal poster background/text colours and a visual catalogue mark. `mark` is not a booking identifier. |

`npm run check` validates required copy, unique IDs, runtimes, times, screens and colours. The server separately validates user/tool requests; catalogue checks do not establish live-agent accuracy or replace runtime validation. Simulated ticket prices live in the cinema service, not in this file.


`package.json` selects native ES modules, Node 22.x and the start/dev/test/check commands. `private: true` prevents npm package publication, not website or Git publishing. `.vercelignore` excludes secrets and local documentation/test artefacts from hosting uploads; `.gitignore` also excludes the local hosting link and generated artefacts.

## Original content and references

Catalogue copy, poster artwork and cinema details were created for this project with AI assistance. No external film database, real movie poster, scraped listing or stock imagery is included. Incidental title overlap is possible; these entries do not represent real works.

Technical references checked 27 September 2026: [AssemblyAI events](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference), [browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration), [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js) and [Vercel rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
