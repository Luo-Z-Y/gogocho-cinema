# Gogocho Cinema

A fictional independent cinema with a conversational box office. Find a film for your mood and available time, explore an original programme, and try a clearly labelled demo booking.

Built for a solo entry to the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon). **Gogocho Cinema is a working product name. The lablab team is still Gogocho; no team rename has been made.**

## Run locally

Requires Node.js 22.9 or later. There are no npm dependencies or build steps. Run commands from the repository root; `npm start` launches `backend/server.js` and serves the frontend from the same local address.

```sh
npm start
```

Open <http://127.0.0.1:3000>. The catalogue, filtering and demo booking work without credentials. `npm run dev` restarts the server when source files change; refresh the browser after client edits.

To enable voice, copy `.env.example` to `.env`, put your AssemblyAI API key in that local file, and restart the server. Keep the key out of chat, screenshots and Git. AssemblyAI sign-in alone does not configure the application: the key needs Voice Agent API access and sufficient credits.

```sh
cp .env.example .env
# Edit .env locally, then:
npm start
```

Press **Start talking** and allow microphone access. Try: “Something light, under two hours, tomorrow, finishing before ten.” Choose a screening and ticket quantity, then press **Confirm demo booking** on the review card. Voice prepares the review; confirmation is an explicit on-screen action in this version. Typing is also available during an active voice session.

If your speech is not detected, open **Microphone**, choose your intended input and press **Test mic** while speaking. The bars now represent actual input volume. Silence, muted input and stalled capture are reported separately. Bluetooth devices resume the audio contexts again after permission and input-route changes.

## What is implemented

- Eight original fictional films with descriptions, conversation notes, audience guidance and typographic posters.
- A rolling seven-day programme across two screens, using Asia/Singapore time.
- Mood, date, runtime and finish-time filters; finish times calculated in code. **Finish before** is one compact field: click **Any time** to enter a cutoff, and use the × to remove it. Both states keep the same height. Reset and voice searches synchronise this control. “Before” is strict, and past screenings are excluded.
- One to six simulated tickets at S$12 each, expiring review cards and stable demo references on retries.
- An AssemblyAI Voice Agent API client: temporary tokens, microphone PCM resampling, streamed playback, transcripts, interruption handling and two validated tools.
- A microphone selector, real input waveform and six-second **Test mic** check. The local test sends no audio to AssemblyAI and releases the microphone afterwards; an active conversation can switch input without opening another provider session.
- A minimal interface with concise labels and one title per poster. Film descriptions, language and audience guidance open under **Details**.
- Responsive layouts, native labelled controls, reduced-motion support and keyboard-operable film details and booking dialogue.

All films, screening times, prices and bookings are fictional. Content notes are editorial guidance, not official age ratings. No seats are held, no real tickets are issued, and no payment is taken.

## How it works

`backend/server.js` serves the frontend and validates tool requests. `backend/cinema/films.json` is the source of catalogue content and each film's daily screening slot. `backend/cinema/service.js` generates future screenings, filters them and validates booking reviews. `backend/voice/agent.js` supplies the voice brief and tool schemas.

The server exchanges `ASSEMBLYAI_API_KEY` for a single-use token. The browser connects directly to AssemblyAI using that token and sends inline session configuration. The agent can call `search_screenings` and `prepare_booking`; the browser routes these requests to the local server. Neither tool confirms a booking. A separate browser confirmation request validates the current cookie-scoped review.

Audio is captured at the device sample rate and resampled to 24 kHz PCM16 in an AudioWorklet. Playback uses 24 kHz buffers with browser resampling. Both tools use AssemblyAI's `hold` execution mode; their results resume the agent response automatically. Ending a conversation sends `session.end`, stops audio and releases the microphone.

API routes:

| Route | Purpose |
| --- | --- |
| `GET /api/programme` | Original catalogue, future screenings and voice configuration status |
| `POST /api/tool` | Validated `search_screenings` or `prepare_booking` request |
| `POST /api/confirm` | Confirm the current demo review by quote ID |
| `POST /api/voice-session` | Exchange the server key for a temporary token and session configuration |

## File organisation

The folders reflect the execution boundaries and features: **`frontend/` runs in the browser**, **`backend/` runs in Node.js**, and **`test/` mirrors those two sides**. This is still one dependency-free application, served by one Node.js process—not separately deployed frontend/backend services.

The old `public/` folder was the frontend, but its name described static-file delivery rather than architecture. Following the user's clarified preference on 16 September 2026, it was replaced by `frontend/`; the root server and generic `lib/`/`data/` directories were grouped under `backend/`.

Tracked project files (Git internals and ignored local files are omitted):

```text
gogocho/
├── frontend/                    # Browser application; never store provider keys here
│   ├── index.html               # Page structure, controls and booking dialogue
│   ├── style.css                # Layout, typography, responsive/accessibility styles
│   ├── app.js                   # DOM updates, forms, HTTP requests and voice/UI integration
│   ├── assets/
│   │   └── favicon.svg          # Local site icon
│   └── voice/
│       ├── client.js            # Voice session, microphone, playback and tool events
│       └── pcm-worklet.js       # Audio-thread conversion to 24 kHz mono PCM16
├── backend/                     # Trusted application rules and HTTP boundary
│   ├── server.js                # Entry point, routes, token exchange and local session state
│   ├── cinema/
│   │   ├── service.js           # Programme, filtering, prices and booking validation
│   │   └── films.json           # Original fictional catalogue and daily screening slots
│   └── voice/
│       └── agent.js             # Voice prompt, greeting, audio options and tool schemas
├── test/                        # Node tests; provider/audio fixtures are simulated
│   ├── frontend/
│   │   ├── voice.test.js        # Tool events, interruption/cleanup and input diagnostics
│   │   └── audio.test.js        # Worklet PCM format and resampling timing
│   └── backend/
│       ├── cinema.test.js       # Schedule, filters, booking rules, expiry and retries
│       └── server.test.js       # Asset loading, privacy, HTTP/cookies and mocked tokens
├── scripts/
│   └── check.js                 # JavaScript syntax and catalogue consistency checks
├── docs/
│   ├── DEMO.md                  # Manual/live scenarios, completion criteria and run records
│   └── PROGRESS.md              # Dated changes, evidence, risks and decisions
├── package.json                 # Shared Node version, ES modules and npm commands
├── .env.example                 # Configuration template; never put real keys here
├── .gitignore                   # Excludes credentials, logs and local/generated artefacts
├── AGENTS.md                    # Workspace coding and documentation conventions
└── README.md                    # Setup, architecture, file map and current scope
```

### Responsibilities and boundaries

- **Frontend presentation:** `frontend/app.js` owns film/review rendering, filter synchronisation and explicit confirmation. It imports the voice client and supplies callbacks for transcripts, connection/input state and tool requests. HTML and CSS remain separate from those event handlers.
- **Frontend voice:** `frontend/voice/client.js` manages the AssemblyAI WebSocket and audio lifecycle without querying page elements. It loads its sibling `pcm-worklet.js` relative to `import.meta.url`, so audio processing runs off the page's main thread. This is browser integration, not the cinema's business logic.
- **Backend cinema:** `backend/cinema/service.js` loads the neighbouring catalogue and owns programme generation, strict time filtering, simulated totals, review expiry and confirmation validation. It does not depend on HTTP, the browser or AssemblyAI. The catalogue's filesystem location stays private; its fictional content reaches the browser through API responses.
- **Backend voice configuration:** `backend/voice/agent.js` builds the prompt and tool schemas using the cinema service. It describes available operations; it does not execute them. Its configuration is sent to the browser and provider, so it must contain no secrets. The agent's proposed arguments still require server-side validation.
- **Backend HTTP:** `backend/server.js` connects those modules to the API, checks origins, scopes reviews to browser cookies and exchanges the server-only key for temporary tokens. Reviews and rate-limit counters remain in memory; there is no database or compiled output directory.
- **Verification and documentation:** `test/frontend/` and `test/backend/` identify the code under test; both run through `npm test` in Node.js. They are not live browser/provider tests. `scripts/` holds maintenance checks, while `docs/` records manual/live scenarios and evidence. Obsidian notes remain outside this repository in the sibling `whatever-it-takes/03 Projects/Gogocho` folder.

### How the architecture connects

```text
frontend/app.js -- /api/* --> backend/server.js
       |                         |-- cinema/service.js --> cinema/films.json
       |                         `-- voice/agent.js ----> cinema/service.js
       v
frontend/voice/client.js <--> AssemblyAI Voice Agent API
       `-- pcm-worklet.js
```

1. The page loads `app.js`, which imports the browser voice client. Starting voice obtains a temporary token and agent configuration from `/api/voice-session`; microphone audio then goes directly to AssemblyAI, not through the cinema server.
2. A form search goes from `app.js` to `/api/tool`, then to `searchScreenings()` in the backend cinema service. A voice search first arrives as `tool.call` in the voice client and uses the `runTool` callback in `app.js` to reach that same endpoint. Results update the page and return to the agent as `tool.result`.
3. `prepare_booking` follows the same path to `prepareBooking()` and opens a review. The visitor's confirmation action separately calls `/api/confirm`, which checks the review through `confirmBooking()`. There is no confirmation tool; all bookings remain fictional.

### Filesystem paths versus browser URLs

The backend serves **only explicitly allowlisted frontend assets**. Folder names alone do not enforce security, and adding a file under `frontend/` does not automatically expose it.

| Browser URL | Source file |
| --- | --- |
| `/` | `frontend/index.html` |
| `/app.js` | `frontend/app.js` |
| `/style.css` | `frontend/style.css` |
| `/assets/favicon.svg` | `frontend/assets/favicon.svg` |
| `/voice/client.js` | `frontend/voice/client.js` |
| `/voice/pcm-worklet.js` | `frontend/voice/pcm-worklet.js` |

`/backend/*`, repository configuration, tests and `.env` are not static routes. Keep the private `.env` at the repository root beside `package.json`; `npm start`/`npm run dev` load it into the backend environment. Do not copy it into `frontend/`. After upgrading from the old layout, restart the server with `npm start` and reload the page to pick up the nested voice/icon URLs. The application URL and all `/api/*` routes are unchanged; restarting clears in-memory reviews and limits.

### Where to make a change

| Change | Start here | Verify with |
| --- | --- | --- |
| Film copy, runtime, poster colours or daily screening slot | `backend/cinema/films.json` | `npm run check`, cinema tests and affected demo expectations |
| Scheduling, filters, ticket price or review/confirmation rules | `backend/cinema/service.js` | `test/backend/cinema.test.js` and relevant server tests |
| Conversation style, greeting, voice options or tool instructions | `backend/voice/agent.js` | Automated checks plus separately recorded live-agent scenarios |
| Layout, controls, film cards or reviews | `frontend/index.html`, `frontend/style.css`, `frontend/app.js` | Browser viewport/keyboard checks and simulated-tool UI synchronisation |
| Microphone, WebSocket events, playback or audio conversion | `frontend/voice/client.js`, `frontend/voice/pcm-worklet.js` | `test/frontend/` and separately recorded real-device checks |
| API/static routes, token exchange, origin checks or session storage | `backend/server.js` | `test/backend/server.test.js` and affected manual/live scenarios |

A new tool spans the architecture: define its schema in `backend/voice/agent.js`, implement and validate the operation in backend code, route it in `backend/server.js`, allow it in `frontend/voice/client.js`, and add any result rendering in `frontend/app.js`. Add matching tests; a schema alone does not execute a function or enforce its rules. Keep authoritative time, price and booking validation in the backend rather than duplicating it in the UI or prompt.

## Scope and verification

This is a local prototype. It binds to `127.0.0.1`, checks mutation origins, and keeps reviews in memory per browser cookie. Restarting the server clears reviews. No database, authentication, real seat inventory or payment system is included. Different tabs in the same browser share the latest review; an older review is rejected at confirmation.

The token endpoint allows five start attempts per hour across the local process. Each voice session is capped at ten minutes, and unused tokens expire after one minute. These limits reset when the server restarts. They are development guardrails, not public deployment controls.

Starting voice sends microphone audio to AssemblyAI. The page retains up to 100 transcript messages in memory, clears them on a new conversation or reload, and does not save recordings locally. AssemblyAI's own processing and retention are governed by its service settings and terms. Safari, Firefox and real microphone quality still require manual checks.

```sh
npm test
npm run check
```

Automated tests cover scheduling, constraints, review validation, cookie isolation, token handling and audio resampling. Chrome browser checks cover responsive layouts, filtering, demo confirmation, and a simulated voice session with a real browser AudioWorklet. **Live AssemblyAI token issuance, session configuration and greeting audio/transcript were verified on 16 September 2026. A generated spoken phrase was transcribed through the live browser pipeline, and the user confirmed their AirPods conversation works after microphone selection and capture recovery improvements. A full spoken booking journey remains to be checked.** See [progress](docs/PROGRESS.md) and the [demo checklist](docs/DEMO.md).

## Next milestone

**Current stage: local prototype working; full spoken booking verification pending.** The 16 September 2026 frontend/backend reorganisation passed all 18 automated tests and the syntax/catalogue checks. An isolated Chrome rehearsal checked the relocated modules, real AudioWorklet with synthetic input, simulated voice tools, demo confirmation and responsive controls. This was not a live-provider conversation; results and limitations are recorded in [the detailed progress log](docs/PROGRESS.md).

The delivery order is:

1. Complete and record the [spoken demo journey](docs/DEMO.md), from constrained discovery to an explicitly confirmed fictional booking and microphone release.
2. Test live interruptions, preference carry-over, ambiguous titles, no-match recovery and quantity changes; fix observed failures and retest.
3. Prepare controlled HTTPS hosting, durable access/rate controls and an authorised repository remote before public sharing.
4. Recheck event requirements and prepare the demo, public source, video, slides and submission materials.

No public deployment or submitted entry is claimed, and no Git remote is configured. Progress entries must distinguish automated/simulated checks, manual browser checks, live-provider checks and user reports; include failures, remaining risks and the next action. Keep the linked Obsidian project notes aligned with the repository documentation.

## Data and assets

Catalogue copy, cinema details, typographic poster layouts and colour choices were created for this project with AI assistance. No external film APIs, real-film summaries, movie posters, scraped listings or third-party stock imagery are included. Incidental title overlap with real works is possible; these are fictional catalogue entries, not representations of those works.

Technical references checked on 16 September 2026: [browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration), [inline configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration), [tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/overview), and [WebSocket events](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference).
