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
- Mood, date, runtime and finish-time filters; finish times calculated in code. “Before” is strict, and past screenings are excluded.
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

## Scope and verification

This is a local prototype. It binds to `127.0.0.1`, checks mutation origins, and keeps reviews in memory per browser cookie. Restarting the server clears reviews. No database, authentication, real seat inventory or payment system is included. Different tabs in the same browser share the latest review; an older review is rejected at confirmation.

The token endpoint allows five start attempts per hour across the local process. Each voice session is capped at ten minutes, and unused tokens expire after one minute. These limits reset when the server restarts. They are development guardrails, not public deployment controls.

Starting voice sends microphone audio to AssemblyAI. The page retains up to 100 transcript messages in memory, clears them on a new conversation or reload, and does not save recordings locally. AssemblyAI's own processing and retention are governed by its service settings and terms. Safari, Firefox and real microphone quality still require manual checks.

```sh
npm test
npm run check
```

Automated tests cover scheduling, constraints, review validation, cookie isolation, token handling and audio resampling. Chrome browser checks cover responsive layouts, filtering, demo confirmation, and a simulated voice session with a real browser AudioWorklet. **Live AssemblyAI token issuance, session configuration and greeting audio/transcript were verified on 16 September 2026. A generated spoken phrase was transcribed through the live browser pipeline, and the user confirmed their AirPods conversation works after microphone selection and capture recovery improvements. A full spoken booking journey remains to be checked.** See [progress](docs/PROGRESS.md) and the [demo checklist](docs/DEMO.md).

## Data and assets

Catalogue copy, cinema details, typographic poster layouts and colour choices were created for this project with AI assistance. No external film APIs, real-film summaries, movie posters, scraped listings or third-party stock imagery are included. Incidental title overlap with real works is possible; these are fictional catalogue entries, not representations of those works.

Technical references checked on 16 September 2026: [browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration), [inline configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration), [tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/overview), and [WebSocket events](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference).
