# Gogocho Cinema

A fictional independent cinema with a conversational box office. Find a film for your mood and available time, explore an original programme, and try a clearly labelled demo booking.

Built for a solo entry to the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon). **Gogocho Cinema is a working product name. The lablab team is still Gogocho; no team rename has been made.**

## Run locally

Requires Node.js 22.9 or later. There are no npm dependencies or build steps.

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

`server.js` serves the browser and validates tool requests. `data/films.json` is the source of catalogue content and each film's daily screening slot. `lib/cinema.js` generates future screenings, filters them and validates booking reviews. `lib/agent.js` supplies the voice brief and tool schemas.

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

The current layout is appropriate for this small, dependency-free application. It separates server rules, browser behaviour, catalogue data and verification without introducing a framework, build pipeline or unnecessary directory layers. The 16 September 2026 organisation review kept the existing paths; no restructuring was needed.

Tracked project files (Git internals and ignored local files are omitted):

```text
gogocho/
├── server.js                 # Node.js entry point, HTTP routes and local session state
├── package.json              # Node version, ES modules and npm commands
├── .env.example              # Local configuration template; never put real keys here
├── .gitignore                # Excludes credentials, logs and local/generated artefacts
├── AGENTS.md                 # Workspace coding, verification and documentation conventions
├── README.md                 # Setup, architecture, file map and current scope
├── data/
│   └── films.json            # Original fictional films, poster colours and daily slots
├── lib/                     # Server-side application modules
│   ├── cinema.js             # Programme, filtering, prices and booking validation
│   └── agent.js              # Voice prompt, greeting, audio options and tool schemas
├── public/                  # Browser code and assets; no secrets
│   ├── index.html            # Page structure, controls and booking dialogue
│   ├── style.css             # Layout, typography, posters and responsive/accessibility styles
│   ├── app.js                # DOM updates, forms, API requests and voice/UI integration
│   ├── voice.js              # Voice session, microphone, playback and tool-event handling
│   ├── pcm-worklet.js        # Audio-thread resampling to 24 kHz mono PCM16 frames
│   └── favicon.svg           # Local site icon
├── test/                    # Automated Node tests; provider/audio fixtures are simulated
│   ├── cinema.test.js        # Schedule, filters, booking rules, expiry and retries
│   ├── server.test.js        # HTTP safeguards, cookie isolation and mocked token exchange
│   ├── voice.test.js         # Tool events, interruption/cleanup and input diagnostics
│   └── audio.test.js         # Worklet PCM format and resampling timing
├── scripts/
│   └── check.js              # JavaScript syntax and catalogue consistency checks
└── docs/
    ├── DEMO.md               # Manual/live scenarios, completion criteria and run records
    └── PROGRESS.md           # Dated changes, verification evidence, risks and decisions
```

A local `.env` may sit beside `server.js`, but it is ignored by Git and must remain private. `npm start`/`npm run dev` load it into the server environment. There is no compiled output directory or database; reviews and local rate-limit counters currently live in server memory.

### Responsibilities and boundaries

- **`server.js` handles HTTP and server state.** It serves an explicit allowlist of files from `public/`, checks request origins, scopes reviews to a browser cookie, exchanges the provider key for temporary tokens and routes requests to the application functions. Adding a file to `public/` alone does not make it available over HTTP; add an intentional route to the allowlist if needed. The repository root, `.env`, `lib/` and `data/` are not exposed as static directories.
- **`lib/cinema.js` owns the cinema rules.** It loads `data/films.json`, calculates screenings and finish times, validates search/booking arguments, calculates simulated totals and checks confirmation eligibility. It does not depend on HTTP, the browser or AssemblyAI. Do not move authoritative price, time or booking validation into the prompt or UI.
- **`lib/agent.js` describes the conversation, not tool implementations.** It uses the catalogue and programme to build the prompt and allowed tool arguments. Its configuration is sent to the browser and AssemblyAI, so it must not contain secrets. Tool schemas guide the agent; server-side validation remains necessary.
- **`public/app.js` owns the page.** It renders films and reviews, synchronises filter controls, handles explicit confirmation and supplies callbacks to `VoiceBoxOffice`. **`public/voice.js` owns the voice connection and audio lifecycle**, reporting transcripts, input levels, state and tool requests through those callbacks rather than querying page elements itself. **`public/pcm-worklet.js`** runs the audio processing separately from the page's main thread.
- **`test/`, `scripts/` and `docs/` are development support, not browser assets.** Automated tests do not establish live-provider quality. Keep live rehearsal evidence in the demo/progress documents. The linked Obsidian plan and progress log live outside this repository in the sibling `whatever-it-takes/03 Projects/Gogocho` folder.

### How the files connect

1. `server.js` imports `lib/cinema.js` and `lib/agent.js`; `lib/agent.js` also uses the catalogue/programme exported by `lib/cinema.js`. The catalogue JSON is loaded on the server, and the browser receives catalogue and screening data through API responses.
2. `public/index.html` loads `public/app.js` as an ES module. `app.js` imports `VoiceBoxOffice` from `voice.js`; `voice.js` loads `/pcm-worklet.js` through the browser's AudioWorklet API when capture starts.
3. A form search goes from `app.js` to `POST /api/tool`, through `server.js` to `searchScreenings()` in `lib/cinema.js`. A voice search first arrives as AssemblyAI's `tool.call` event in `voice.js`, then uses the `runTool` callback in `app.js` and the same server endpoint. Returned data updates the page; for a voice call it also goes back to AssemblyAI as `tool.result`.
4. `prepare_booking` follows that same path to `prepareBooking()` and opens a review. Only the visitor's confirmation action in `app.js` calls `POST /api/confirm`, which checks the review through `confirmBooking()`. Confirmation is not an agent tool; all bookings remain fictional.

### Where to make a change

| Change | Start here | Verify with |
| --- | --- | --- |
| Film copy, runtime, poster colours or daily screening slot | `data/films.json` | `npm run check`, cinema tests and affected demo expectations |
| Schedule generation, filtering, ticket price or review/confirmation rules | `lib/cinema.js` | `test/cinema.test.js` and relevant server tests |
| Conversation style, greeting, voice options or tool instructions | `lib/agent.js` | Automated regression checks plus separately recorded live-agent scenarios |
| Layout, controls, film cards or review presentation | `public/index.html`, `public/style.css`, `public/app.js` | Browser viewport/keyboard checks and UI synchronisation with simulated tools |
| Microphone selection, WebSocket events, playback or audio conversion | `public/voice.js`, `public/pcm-worklet.js` | `test/voice.test.js`, `test/audio.test.js` and separately recorded real-device checks |
| API routing, token exchange, origin checks or session storage | `server.js` | `test/server.test.js` and affected manual/live scenarios |

Adding a new agent tool is a cross-layer change: define its schema/instructions in `lib/agent.js`, implement and validate its operation in server-side code, explicitly route it in `server.js`, allow it in `public/voice.js`, and add any result rendering in `public/app.js`. Add matching tests; a schema alone does not execute a function or enforce its rules.

If public authentication, durable storage or multiple voice providers make these modules harder to maintain, extract the growing responsibilities then—for example, server session/token handling or browser capture/playback. Moving everything under `src/` or creating controller/service layers now would add path changes without improving the existing separation. Any later file move must also update imports, the static-file allowlist, browser/worklet URLs, tests and this map.

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

**Current stage: local prototype working; full spoken booking verification pending.** On 16 September 2026, the documentation checkpoint reran all 17 automated tests and the syntax/catalogue checks successfully. No new browser or live-provider session was run at that checkpoint; earlier live evidence is recorded separately in [the detailed progress log](docs/PROGRESS.md).

The delivery order is:

1. Complete and record the [spoken demo journey](docs/DEMO.md), from constrained discovery to an explicitly confirmed fictional booking and microphone release.
2. Test live interruptions, preference carry-over, ambiguous titles, no-match recovery and quantity changes; fix observed failures and retest.
3. Prepare controlled HTTPS hosting, durable access/rate controls and an authorised repository remote before public sharing.
4. Recheck event requirements and prepare the demo, public source, video, slides and submission materials.

No public deployment or submitted entry is claimed, and no Git remote is configured. Progress entries must distinguish automated/simulated checks, manual browser checks, live-provider checks and user reports; include failures, remaining risks and the next action. Keep the linked Obsidian project notes aligned with the repository documentation.

## Data and assets

Catalogue copy, cinema details, typographic poster layouts and colour choices were created for this project with AI assistance. No external film APIs, real-film summaries, movie posters, scraped listings or third-party stock imagery are included. Incidental title overlap with real works is possible; these are fictional catalogue entries, not representations of those works.

Technical references checked on 16 September 2026: [browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration), [inline configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration), [tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/overview), and [WebSocket events](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference).
