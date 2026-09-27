# Progress

## Current status — 16 September 2026

**Stage: local prototype working; end-to-end live demonstration pending.** The programme, demo booking and voice integration are implemented. Live API access and an AirPods conversation have been established, but a complete spoken discovery-to-confirmation journey has not been verified.

The entries below record implementation changes, architecture decisions, verification evidence, outstanding risks and completion criteria. Earlier entries are historical: statements such as “live voice remains unverified” describe that earlier checkpoint, not the current state. Use [the demo checklist](DEMO.md) to record the next live run.

## 16 September 2026 — First local prototype

Working name: Gogocho Cinema. User is participating solo as lablab team Gogocho. The lablab team has not been renamed.

Implemented the original eight-film catalogue, rolling Singapore programme, responsive browser interface, deterministic screening tools and explicit demo confirmation. Added the server token exchange and AssemblyAI browser voice client with resampling, playback, interruption handling and microphone cleanup. The local server has no dependencies beyond Node.js 22.9 (the minimum for the optional environment-file startup flag).

Verification:

- All 15 Node tests passed: screening dates and finish times, strict filter boundaries, non-overlapping screenings, invalid input, review expiry, stable confirmation retries, cookie isolation, missing credentials, provider errors, token caps, 24/44.1/48 kHz audio timing, hold-tool events, interruptions and session cleanup.
- JavaScript syntax and catalogue validation.
- Chrome interface checks passed at 1440 px, 390 px and 320 px: mood/time filtering, no-match recovery, three-ticket S$36 review, explicit confirmation and the missing-key message. A simulated WebSocket session used the real browser AudioWorklet, updated the programme through tools, opened a booking review and ended cleanly. No page errors were observed. This does not establish live-provider behaviour.
- Live AssemblyAI conversation, account credits and API entitlement remain unverified; no API key was read or stored during setup.

Next:

1. Add the API key locally and test a real voice session, including interruptions and noisy audio.
2. Test ambiguous film titles, preference carry-over and no-match recovery with the live agent; tune the prompt from observed behaviour.
3. Decide the final product/team name and update lablab if desired.
4. Prepare authentication and durable rate limiting for public deployment, then a public repository, demo, video and slides.

The Obsidian project notes are maintained in the sibling `whatever-it-takes` vault under `03 Projects/Gogocho`. Keep their status aligned with this file and the README. The local prototype is not a submitted or deployed hackathon entry.

Version control decision: commit this verified local foundation. Do not push or publish yet: no remote is configured. The Obsidian vault is separate and is not a Git repository.


## 16 September 2026 — Minimal interface

Reduced the visible copy at the user's request: removed slogans, introductory paragraphs, repeated poster labels, duplicate film titles and decorative footer text. Film descriptions, language and audience guidance now sit inside a keyboard-operable Details disclosure. The voice panel is smaller, with one clear Start talking action and concise status/privacy text. Booking copy is shorter, with the demo/no-payment notice retained at confirmation.

Verification: all 15 existing tests and syntax/catalogue checks pass. Desktop and mobile browser checks cover filters, Details disclosure, demo confirmation and the mock voice flow. Live AssemblyAI remains unverified.

Updated the README and Obsidian project notes. Commit the verified interface change locally; no push because no remote is configured.


## 16 September 2026 — Voice configured

The user saved the AssemblyAI key in the local `.env` file. Confirmed that the file is excluded from Git and has owner-only read/write permissions; no credential was displayed or committed. Restarted the local server with the saved configuration.

A short live check succeeded: temporary token issued, WebSocket session ready, inline configuration accepted, greeting audio received and greeting transcript received. Sent `session.end` and closed the test connection. This establishes working API access; it does not verify microphone quality, a full spoken booking journey or the account's remaining credits.

Next: refresh the local cinema, press Start talking, allow microphone access and complete the spoken demo checklist. The local server remains running.

Version control decision: commit the verified setup record and updated documentation only. Keep `.env` private and untracked. No push because no remote is configured.


## 16 September 2026 — Microphone recovery and diagnostics

The user could hear the greeting but their speech was not recognised. macOS was using the AirPods input, which the user confirmed was intended. The original client did not measure incoming sound and showed a decorative waveform even during silence. The initial device-level cause could not be isolated retrospectively.

Added explicit input selection (including switching during a session), an input-driven waveform, separate silence/mute/stall feedback and a six-second local microphone test. The test does not request a provider token or transmit audio, and closes capture automatically. Audio contexts resume again after microphone permission and Bluetooth route changes. Controls remain disabled until initialisation finishes.

Verification: 17 automated tests and syntax/catalogue checks passed. Browser tests distinguished silent and audible local input, requested no tokens, released microphone tracks and had no mobile overflow. A generated spoken phrase traversed the real browser worklet and AssemblyAI service and returned a user transcript. The user then confirmed their AirPods microphone and live conversation work. Full spoken booking completion remains to be tested.

Updated README, demonstration checklist and Obsidian project notes. Commit the verified changes locally; no push because no remote is configured. Credentials remain excluded from Git.


## 16 September 2026 — Detailed readiness checkpoint and delivery plan

### Objective and scope

The user asked what comes next and requested detailed progress documentation. The priority is to prove the full live demonstration, address observed conversational failures, then prepare controlled sharing and the hackathon submission. Expanding the catalogue or adding accounts, payments and real seat inventory is not the next milestone.

This checkpoint changes documentation only. No application logic, catalogue content, provider configuration or deployment was changed. The implementation baseline is local commit `134ac2d` (`Add microphone selection, capture recovery and input diagnostics`). No new live-provider call or browser interaction was performed for this checkpoint.

### Implemented baseline

| Area | Current behaviour | Important boundary |
| --- | --- | --- |
| Catalogue and interface | Eight original fictional films, typographic posters, compact Details disclosures, responsive filters and booking dialogue | No external film metadata, posters or real listings; all films, times, prices and bookings are fictional |
| Programme | Rolling seven-day Asia/Singapore schedule across two screens; mood, date, runtime and finish-time filtering | Code excludes started screenings and calculates finish times; “before” is strict |
| Demo booking | One to six tickets at S$12 each; server-validated screening IDs, quantities, expiring reviews and stable confirmation retries | Voice only prepares a review; the visitor must confirm on screen. No payment, seat hold or real ticket |
| Voice | Server-issued temporary token, browser PCM capture/resampling, streamed playback, transcripts and validated search/booking tools | The provider key remains server-side; live conversational accuracy is not established by mocked tests |
| Microphone | Input selection and switching, real input meter, silence/mute/stall feedback and six-second local Test mic | The local test does not contact AssemblyAI; microphone quality still depends on the device/browser |
| Local safeguards | Loopback binding, mutation-origin checks, cookie-scoped reviews and process-local token limits | These are prototype guardrails, not public deployment controls |

### Fresh automated verification

Run on 16 September 2026, Singapore time, using Node.js `v22.23.2` and npm `10.9.8`:

- `npm test`: **17 passed, 0 failed, 0 skipped**.
- `npm run check`: **passed** — JavaScript syntax and catalogue validation.
- Documentation checks: `git diff --check` passed; all six relative Markdown links and both Obsidian links resolved; all five edited documents had no trailing whitespace.
- Repository/privacy checks: `.env` remains ignored; no credential contents were read; no Git remote is configured. Confirmed the sibling Obsidian vault is not a Git repository.
- The application tests use local fixtures and simulated provider responses. They do not exercise a real microphone, consume a live provider session or prove spoken booking completion.

| Test file | Tests | Behaviour checked |
| --- | --- | --- |
| `test/cinema.test.js` | 5 | Singapore date rollover, seven-day programme, exclusion of started screenings, calculated end times, strict finish-before and runtime constraints, screen non-overlap, invalid/no-match searches, booking IDs and quantities, review expiry, explicit confirmation state and stable retry references |
| `test/server.test.js` | 4 | Missing-key handling, private-file rejection, origin isolation, rejection of a confirmation tool, cookie/latest-review isolation, mocked temporary-token exchange, ten-minute session cap request, five-attempt rate limit and provider-error redaction |
| `test/voice.test.js` | 5 | Hold-tool response handling, unsupported-tool rejection, simulated interruption/playback cleanup, queued typed messages, microphone release, late-result rejection, input-level feedback, silent/muted/stalled capture distinctions and selected-device constraints |
| `test/audio.test.js` | 3 | Worklet timing and PCM frame format at 24, 44.1 and 48 kHz input rates in a simulated worklet environment |

The catalogue check also validates unique film IDs, required copy fields, positive runtimes below 180 minutes, screening-time format, valid screens and colour values. It is not a substitute for a browser accessibility or live-agent check.

### Previously recorded evidence — not rerun at this checkpoint

Keep these categories separate from the fresh automated results:

- **Browser checks with a simulated provider:** Chrome at 1440, 390 and 320 px; filtering, no-match recovery, Details disclosure, explicit demo confirmation and a simulated voice/tool journey using the browser AudioWorklet. Subsequent microphone checks distinguished silence from audible input, issued no provider tokens during Test mic, released capture and checked mobile overflow.
- **Live AssemblyAI checks:** temporary token issuance, WebSocket readiness, inline configuration, greeting audio/transcript and transcription of a generated spoken phrase through the real browser audio pipeline. Generated speech verifies that pipeline, not the user's full spoken booking experience.
- **User confirmation:** the user reported that their AirPods microphone and live conversation work after the microphone improvements. This is user-reported device success, not a recorded end-to-end booking test.

### Next milestones and completion criteria

1. **Full spoken booking — next action, pending.** Follow the core journey in `docs/DEMO.md`. Record the actual future screening date in Singapore time. Ask for something light, under two hours, tomorrow, finishing before 22:00; expect The Last Table and Sideways Summer without dropping constraints. Choose The Last Table at 17:00 and two tickets. The review must show the intended date, Screen 1, finish 18:36 and S$24. No booking is confirmed before the visitor's click; the click must produce a DEMO reference and the no-payment/no-reservation notice. End the session and verify microphone release. A spoken selection that only opens a review is not full completion.
2. **Conversational reliability — pending.** Run the live edge cases: preference carry-over, ambiguous or partial titles, impossible combinations, strict finish-time boundaries, quantity changes, fictional-content boundaries and interruptions. Also check noisy audio and connection recovery. Record exact expected versus actual behaviour. Make prompt or logic changes only in response to observed failures, rerun automated checks, and repeat the failed live scenario before marking it fixed.
3. **Controlled public sharing — pending, not authorised or configured by this checkpoint.** Choose hosting and establish an authorised repository remote. Before exposing the demo, verify HTTPS microphone access, server-only credentials, controlled access, durable abuse/rate limits, a provider spending/session policy and a deliberate retention/privacy policy. Check the provider credit balance separately. Test the deployed journey and missing-key/disconnect states; local success alone is insufficient.
4. **Submission package — pending.** Confirm the final product/team name and recheck the event page/form. Prepare the accessible demo, public source repository, descriptions/tags, cover image, video and slides. Existing notes list an MP4 of at most five minutes, PDF slides and a closing time of 30 September 2026 at 23:00 Singapore time; these are previously inspected requirements, not newly verified facts. Ensure all materials describe the catalogue and bookings as fictional. Record the actual submission confirmation only after submitting.

### Open risks and deliberately deferred work

- Full spoken booking, live preference retention, ambiguous-title handling, noisy audio and live interruption quality remain unverified.
- Remaining AssemblyAI credits and provider retention settings have not been inspected. Do not infer either from a successful connection.
- Safari and Firefox still need manual microphone/playback checks. Earlier Chrome checks do not establish cross-browser support.
- Reviews and rate limits are in memory. Restarting the process resets them; tabs in one browser share the latest review. These limitations must be addressed or explicitly accepted for controlled sharing.
- No remote, public deployment or submitted entry is established. The working product name remains Gogocho Cinema and the lablab team remains Gogocho.
- Database-backed bookings, payments, real-film data and a larger catalogue remain outside the first-version scope. Authentication or controlled access for a public demo is a separate safety requirement, not a commitment to a customer-account feature.

### Documentation and recording convention

Updated `README.md`, `docs/PROGRESS.md`, `docs/DEMO.md` and the sibling Obsidian notes `03 Projects/Gogocho/Project Plan.md` and `Progress Log.md`. The README holds the short status, this file holds the detailed engineering history, the demo checklist holds reproducible scenarios and run records, and Obsidian holds the aligned project plan and progress summary.

For each future work session, record:

1. Date/time with timezone, objective, implementation baseline and changed files.
2. What changed, why, and what was deliberately left unchanged.
3. Verification method and environment, clearly labelled **automated/simulated**, **manual local browser**, **live provider** or **user-reported**.
4. Expected and actual results, failures and reproductions, fixes/retests, and any evidence location. A plan or test script alone is not a pass.
5. Remaining risks, the next action, and commit/push/deployment/submission decisions.

Do not put API keys, temporary tokens, cookies, `.env` contents or personal conversation details into evidence. Use the run-record template in `docs/DEMO.md`; no raw microphone recordings are required.

Version control decision: commit this verified documentation checkpoint locally. Do not push: no remote is configured. The Obsidian vault is separate and is not a Git repository, so its note updates remain outside the software commit.

## 16 September 2026 — Explicit Any time filter

The user requested an unrestricted option for Finish before. Against baseline `e7337ab`, replaced the bare time field with a compact selector defaulting to **Any time**. **Set a time…** reveals and focuses the native time input; a chosen time is required before submitting that mode. Returning to Any time clears and disables the input, so the request omits `endBefore` while retaining the other filters. Reset and voice-tool results synchronise the selector, including arbitrary minute values. The server already supports an omitted limit; no catalogue, provider or booking logic changed.

Changed `public/index.html`, `public/app.js` and `public/style.css`; updated README, the demo checklist and the linked Obsidian plan/progress notes.

Verification on 16 September 2026 (Singapore): all 17 existing automated tests and `npm run check` passed. Automated local browser checks in Chrome 152.0.7977.83 used 17 September screenings: Light returned two results, a strict 18:36 cutoff returned one, and Any time restored two without losing the mood. A simulated call to the existing voice-tool UI callback set 18:37 and displayed five screenings; a subsequent call without a cutoff restored Any time and all eight. Default, required input/focus, reset, and overflow at 1440/801/390/320 px passed, with no page errors or provider token calls. Inspected default and specific-time screenshots at the user's 801 px viewport and reloaded the in-app preview. This verifies UI synchronisation, not a new live voice conversation; full spoken booking remains pending.

Temporary verification artefacts: `/private/tmp/gogocho-any-time-check.cjs`, `/private/tmp/gogocho-any-time-default.png` and `/private/tmp/gogocho-any-time-specific.png`. These contain no credentials and are not committed.

Version control decision: commit this completed, verified filter change locally. No push because no remote is configured. The aligned Obsidian notes remain outside the software repository. Next: complete the full spoken booking rehearsal.

## 16 September 2026 — Compact finish-time control

The user disliked the stacked Set a time selector and time input. Against baseline `977dbb2`, replaced them with one 42 px field: **Any time** and a clock icon switch directly to an editable time, with an inline × to restore Any time. The filter row no longer grows or moves its neighbouring controls when a cutoff is entered. The label follows the active control; keyboard activation focuses the native time input, and clearing returns focus to Any time. A specific cutoff remains required while editing. Reset, other filter values and voice-tool synchronisation retain their behaviour.

Updated HTML, client event handling and CSS, plus README, the demo checklist and both Obsidian project notes. No server, catalogue, booking or provider changes.

Verification: all 17 existing automated tests and syntax/catalogue checks passed. Automated Chrome 152.0.7977.83 checks used 17 September screenings and verified the strict cutoff, clearing without losing mood, reset, keyboard activation/focus, and simulated voice-tool calls with an exact 18:37 cutoff and without a cutoff. At 1440/801/390/320 px, both states had identical filter-row height and no page overflow. Inspected screenshots at 1440/801/320 px; no page errors or provider token requests. This is local UI and simulated-tool evidence, not a new live conversation. Temporary script and screenshots use the `/private/tmp/gogocho-compact-time-` prefix.

Version control decision: commit the completed, verified interface refinement locally. No push because no remote is configured. Obsidian notes remain outside the software repository. The full spoken booking rehearsal remains the next milestone.

## 16 September 2026 — File organisation review and README architecture guide

### Request and baseline

The user asked for an explanation of the file organisation, a restructuring if justified, and documentation in the README. Reviewed the tracked file tree, entry points, imports, browser/worklet loading, HTTP/static routing, tool dispatch and verification commands against baseline `71690af` (`Keep finish-time selection in a single compact field`). Review started at 17:06 Singapore time (UTC+08:00).

### Decision: retain the existing structure

The current layout is suitable for a small, dependency-free Node.js application with native browser modules:

- `server.js` owns the HTTP boundary, temporary-token exchange and in-memory browser review state. `lib/cinema.js` owns programme/booking rules without depending on HTTP or the provider; `lib/agent.js` owns conversational configuration and tool schemas.
- `public/app.js` owns the page and passes callbacks to `public/voice.js`. Voice transport/audio lifecycle is already separated from DOM rendering, and `public/pcm-worklet.js` isolates audio-thread conversion.
- Original catalogue data, automated tests, maintenance scripts and manual/live verification documents have distinct directories. The browser receives data through the API, not by importing private server modules.
- A new `src/` hierarchy, framework or controller/service layer would create path churn without solving a present boundary problem. Revisit module extraction when authentication, durable storage, additional providers or growing audio responsibilities warrant it.

No files were moved or renamed. No imports, static routes, provider configuration, catalogue, UI behaviour or booking rules changed. The compact finish-time control and existing fictional/demo safeguards are unchanged.

### Documentation changes

- Added [File organisation](../README.md#file-organisation) to `README.md`: an annotated tree of tracked files, server/browser/security boundaries, module/request flow and a change-to-file/verification guide.
- Explained the distinction between `lib/agent.js` tool definitions and the validated implementations in `lib/cinema.js`, plus the browser/server allowlists required for a new tool. Documented the separate explicit confirmation route.
- Explained that `public/` is served through an explicit allowlist, `.env` is private and ignored, server-side source paths are not static assets, and review/rate-limit state is currently in memory.
- Recorded future restructuring triggers and the imports, static routes, worklet URLs and tests that a later file move would need to update.
- Updated this progress record and the linked Obsidian project plan/progress log. The demo checklist is unchanged because no scenario or application behaviour changed.

### Verification and remaining work

- `npm test`: **17 passed, 0 failed, 0 skipped**.
- `npm run check`: **passed** — JavaScript syntax and catalogue checks.
- Documentation verification: the README tree matches all **22 tracked files**; all seven local Markdown links (including the new heading link) and both Obsidian links resolve. Checked five project documents for trailing whitespace and ran `git diff --check`; both passed. `.env` remains ignored and no credential contents were read.
- The automated checks use local/simulated fixtures. No new browser rehearsal, microphone check or live-provider session was run for this documentation-only review.
- Full spoken booking, live edge-case reliability, public deployment and submission remain pending; this architecture review does not advance those verification milestones.

Version control decision: commit the verified README/progress update locally. No push because no remote is configured. The aligned Obsidian notes remain outside Git in the separate vault. Next: complete and record the full spoken booking rehearsal using `docs/DEMO.md`.

## 16 September 2026 — Architecture-led frontend/backend reorganisation

### Request and decision

The user clarified that folder names should express the architecture, not just static-file delivery: “public is like the frontend?” This supersedes the earlier decision to retain the layout. The old modules were functionally separated, but `public/`, root `server.js` and generic `lib/`/`data/` names did not make runtime ownership obvious.

Against baseline `a42be57`, reorganised the same dependency-free application into `frontend/`, `backend/`, and matching `test/frontend/` and `test/backend/` directories. Work started at 17:13 Singapore time (UTC+08:00). No framework, bundler, separate deployment, additional npm dependency or new product feature was introduced.

### File moves and integration changes

| Previous location | New location / responsibility |
| --- | --- |
| `public/index.html`, `public/style.css`, `public/app.js` | `frontend/` — browser presentation and API/UI integration |
| `public/voice.js` | `frontend/voice/client.js` — browser voice/session/audio lifecycle |
| `public/pcm-worklet.js` | `frontend/voice/pcm-worklet.js` — audio-thread PCM conversion |
| `public/favicon.svg` | `frontend/assets/favicon.svg` — static presentation asset |
| `server.js` | `backend/server.js` — Node entry point, HTTP boundary and local state |
| `lib/cinema.js`, `data/films.json` | `backend/cinema/service.js`, `backend/cinema/films.json` — authoritative rules and original catalogue |
| `lib/agent.js` | `backend/voice/agent.js` — conversational brief and tool schemas |
| Four root test files | `test/backend/` for cinema/HTTP, `test/frontend/` for voice/audio |

Updated backend imports, the catalogue's module-relative path, frontend imports/icon URL, test imports, the catalogue-check import, and both npm launch commands. The browser voice client now loads its sibling worklet with `new URL('./pcm-worklet.js', import.meta.url)` instead of a root-level hard-coded worklet URL.

The backend's explicit static allowlist now maps the frontend root to `/`, with nested `/voice/client.js`, `/voice/pcm-worklet.js` and `/assets/favicon.svg` asset URLs. `/app.js` and `/style.css` remain unchanged. The app address and all `/api/*` routes are unchanged; backend source/configuration are not static routes. The `.env` file stays private at the repository root beside `package.json`, not inside either application directory.

Cinema calculations, original film content, prices, quantities, review/confirmation rules, provider settings and visual design are unchanged. Voice still cannot confirm a booking. All films, screenings, prices and bookings remain fictional.

### Automated verification

- `npm test`: **18 passed, 0 failed, 0 skipped**. Existing scheduling, constraints, review/cookie isolation, mocked token handling, voice events and resampling tests continue to pass from their new paths.
- Added an HTTP test that checks all six frontend asset responses against the relocated source files, validates their content types, and checks the page/module/worklet references.
- Expanded private-file rejection checks to include backend source and catalogue paths, frontend filesystem paths, configuration, tests/scripts and retired URLs. These remain inaccessible as static resources.
- `npm run check`: **passed** — syntax and catalogue validation use the reorganised source tree.
- Architecture/documentation checks: README tree matches all 22 tracked files; relative JavaScript imports resolve; eight local Markdown/heading links and both Obsidian links resolve. Five project documents have no trailing whitespace; `git diff --cached --check` passed. Confirmed the catalogue, stylesheet, worklet processor and icon are byte-for-byte unchanged from the baseline. `.env` remains ignored.

### Isolated browser verification — simulated provider, not live voice

Used Chrome 152.0.7977.83 with a separate ephemeral-port server fixture, a fixed Singapore date and synthetic 440 Hz microphone input. The token response and browser WebSocket were simulated; no provider key or live AssemblyAI service was used in this rehearsal.

Two complete consecutive runs passed after the harness adjustments below:

- Loaded the moved page, style, ES module and nested voice client. Confirmed the nested worklet request at the fixture server and observed non-zero PCM frames from the real browser AudioWorklet.
- Filtered 17 September screenings to two light films under two hours finishing before 22:00. Opened The Last Table review at 17:00, checked the 18:36 finish and S$24 total, changed to three tickets/S$36 and explicitly confirmed a DEMO reference.
- Ran the six-second local Test mic with synthetic sound. It released all input tracks and made no token or WebSocket request.
- Started one simulated voice session per run, sent actual worklet PCM frames to the mocked socket, delivered search/prepare tool events, and verified both backend results and UI synchronisation. The two-ticket result remained `awaiting_confirmation` until the on-screen click, after which the confirmation context was sent to the agent.
- Ended the simulated conversation, observed `session.end` and verified microphone-track cleanup.
- Checked 1440/801/390/320 px layouts, constant finish-control height, keyboard activation/focus and no horizontal overflow. Inspected desktop/mobile screenshots. Complete runs had no page errors or failed page requests.

Initial observations and harness corrections: one early attempt timed out waiting for the local microphone-success label; the cause was not isolated and is not claimed as a fixed application defect. Added PCM diagnostics for subsequent runs. A later assertion incorrectly assumed Playwright's page-level response events reported the AudioWorklet module fetch, despite successful capture; changed the harness to observe server requests and actual PCM output instead. No application audio logic was changed to make these checks pass. Real microphone/Bluetooth quality and the full spoken booking remain separate live checks.

Temporary, uncommitted evidence: `/private/tmp/gogocho-architecture-check.cjs`, `gogocho-architecture-tone.wav`, `gogocho-architecture-1440.png` and `gogocho-architecture-320.png` in the same temporary directory. The script uses a pre-existing local Playwright installation, not a project dependency; the WAV is generated test tone, not a recording.

### Local runtime and documentation

Verified the old listening process belonged to this project, stopped it and restarted through the updated `npm start`. The local server at `http://127.0.0.1:3000/` serves the new assets and eight-film fictional programme. Its existing voice configuration is detected without requesting a token or displaying the credential. As expected, restarting cleared in-memory reviews and rate-limit counters. Reload an existing page to load the relocated voice/icon URLs. Server output is in `/private/tmp/gogocho-architecture-server.log`.

Replaced the README file map and architecture guide with the frontend/backend tree, runtime responsibilities, dependency/request diagram, filesystem-to-URL mapping, root `.env` guidance and updated change-to-file/test paths. Updated the linked Obsidian plan/progress notes. Historical entries retain the paths and test counts that were correct at those checkpoints; the current source layout is described in [README.md](../README.md#file-organisation).

Version control decision: commit the verified reorganisation and documentation locally. Do not push because no remote is configured. Vault notes remain outside the software repository. Next: complete the full live spoken booking rehearsal; this simulated browser journey does not satisfy that milestone.

## 16 September 2026 — Extensive code comments and data/configuration guide

### Request and scope

The user requested extensive comments throughout all code. Against baseline `ca45154`, starting at 17:32 Singapore time (UTC+08:00), documented the existing implementation without changing executable logic, assets' non-comment markup/styles, configuration values, catalogue content or provider instructions. The frontend/backend architecture and all fictional/demo boundaries remain unchanged.

### Coverage and explanations added

| Area | Commentary added |
| --- | --- |
| `backend/server.js` | Module responsibilities, injectable test dependencies, static allowlist, response headers, origin/cookie boundaries, fixed session lifetime, request-body checks, tool dispatch, explicit confirmation, token-attempt accounting, provider error redaction and loopback entry point |
| `backend/cinema/service.js` | Singapore date arithmetic, stable screening IDs, integer-cent prices, inclusive runtime versus strict finish-before filtering, invalid versus empty queries, random expiring reviews and stable confirmation retries; confirmation returns a copy rather than persisting real bookings |
| `backend/voice/agent.js` | Non-secret session configuration, date snapshot, catalogue grounding, distinction between schema/instruction and implementation, hold-mode results and the deliberate absence of a confirmation tool |
| `frontend/app.js` | UI/API ownership, escaping/display formatting, form argument conversion, compact finish-control states/focus, response-version guards, review/confirmation actions, voice callbacks, transcript retention and navigation cleanup |
| `frontend/voice/client.js` | Capture/session lifecycle, generation guards, permissions/Bluetooth resume, local-only microphone test, device handover, RMS diagnostics, muted/stalled/silent distinctions, socket queue limits, transcript/tool events, PCM playback, message batching and resource cleanup |
| `frontend/voice/pcm-worklet.js` | Audio-thread boundary, 24 kHz/20 ms/480-sample/960-byte framing, fractional interpolation across blocks, signed little-endian PCM, transferable buffers, retained boundary samples and resampler limitations |
| HTML, CSS and SVG | DOM/form contracts, visible fictional/privacy disclosures, semantic controls, accessibility/status regions, modal confirmation, fixed-height filters, responsive layout, input-driven waveform and original icon construction |
| All four test files | Fixture isolation, fixed-clock boundaries, explicit cookie/origin handling, mocked provider/sockets, late-result and cleanup tests, PCM arithmetic and what simulated checks do not establish |
| `scripts/check.js` | Syntax-only execution, path resolution, subprocess failures, catalogue fields/IDs, timing/screen assumptions and hexadecimal colour validation |
| `.env.example`, `.gitignore` | Private root configuration, optional voice access, loopback port, template exception ordering, generated files and log/evidence hygiene |

Comments describe actual behaviour and limitations rather than promising stronger guarantees: the server cannot recover an omitted spoken preference, generation guards do not undo an already completed HTTP operation, RMS is not speech recognition, the worklet uses simple linear interpolation, and the reduced-motion CSS rule does not remove the meter's short transition.

Added the ongoing commenting convention to `AGENTS.md`. Added [Code comments and JSON data](../README.md#code-comments-and-json-data) to the README, including a reading order, all catalogue fields, package settings and local configuration. Strict JSON files were left untouched rather than inserting invalid comments or invented metadata fields. Updated the linked Obsidian plan/progress notes; the demo checklist is unchanged because no interaction or acceptance criterion changed.

### Fresh automated verification — no behaviour change

- `npm test`: **18 passed, 0 failed, 0 skipped**. No assertions or fixtures were removed or weakened.
- `npm run check`: **passed** — JavaScript syntax and catalogue checks.
- Parsed all **11 JavaScript files** before/after with Node's bundled Acorn 8.16.0 and compared complete syntax trees excluding source offsets. All executable trees match the baseline, including the agent prompt/schema strings and test bodies. No parser dependency was added to the project.
- Removed comments/blank lines for comparison of HTML/SVG/CSS: both markup files and every stylesheet rule match the baseline. This is source equivalence, not a fresh visual browser audit.
- Compared active `.env.example` and `.gitignore` entries: values/patterns and their ordering are unchanged. `backend/cinema/films.json` and `package.json` are byte-for-byte unchanged and still parse as strict JSON.
- `git diff --check` passed. The temporary reproducible equivalence check is `/private/tmp/gogocho-comments-check.cjs`; it records baseline `ca45154` and remains outside Git.
- Documentation checks passed: README maps all 22 tracked files; nine local Markdown/heading links and both Obsidian links resolve; six project documents have no trailing whitespace. `.env` remains ignored.

No new browser rehearsal, microphone capture or live-provider call was performed for this commenting pass. Earlier simulated/browser/live evidence remains attributed to its original checkpoints. The existing local server was not restarted, and no private `.env` contents were read or modified. Full live spoken booking, remaining credits, cross-browser checks, deployment and submission are still outstanding.

Version control decision: commit the verified code comments, commenting convention and aligned documentation locally. No push because no remote is configured. Obsidian notes remain outside the software repository. Next: complete and record the full spoken booking rehearsal; comments do not advance that verification milestone.

## 2026-09-27 — Substantial demo upgrade and public hosting

User requested a substantial improvement before hackathon submission. Built eight original geometric SVG posters, a clearer minimal programme, side-by-side film comparison, a labelled three-step guided preview, visible conversation activity, strict preference preservation and a polished confirmed ticket with calendar export. The preview uses real validated cinema APIs without an AI session. Fixed hold-mode tool ordering so results wait for reply.done and HTTP completion, with generation/interruption guards and regression tests.

Added signed two-hour demo state so fictional reviews survive Vercel cold starts. Added a thin native Node hosting entry, explicit deployment files, HTTPS origin validation and secure cookies. Deployed at https://gogocho-cinema.vercel.app. User explicitly approved storing the local AssemblyAI key as a sensitive Vercel environment variable after automatic review required destination-specific permission. No key was printed or committed. Public sessions cap at three minutes; published WAF IP rule limits token starts to three per ten minutes, alongside signed-cookie and per-process backstops. These are not a hard account spending cap.

Verification:

- 26 automated tests and syntax/catalogue checks passed. New checks cover strict comparison, signed-state tampering/expiry/cross-instance confirmation, calendar content and both asynchronous hold-result orderings.
- Public unauthenticated programme returned HTTP 200, eight films, seven dates and configured voice.
- Real AssemblyAI generated-speech run: three spoken requests recognised; search and comparison preserved 28 September/light/119 minutes/before22:00; prepare_booking selected The Last Table, two tickets, S$24, 17:00–18:36 Screen1. Separate explicit API confirmation returned DEMO-C2159CB6. This is real provider speech testing with synthesised audio, not a physical microphone rehearsal.
- First generated-speech harness attempt contained empty audio because macOS synthesis was sandboxed and timed out; recreated non-empty audio through authorised synthesis and the rerun passed. This was not an app speech-recognition failure.
- Public browser guided preview passed search, comparison, two-ticket review and explicit button confirmation (DEMO-D409B101). Calendar content generation passed unit checks, but the in-app browser download observer timed out; successful file download is unverified.
- Typed live messages were inconsistent: one direct-provider experiment completed all tools, but browser/client follow-ups sometimes answered as the visitor or omitted comparison. Removed typed-input controls from the public UI rather than claim this path works. Internal injection methods remain for application context/testing.
- Existing real-device evidence remains the user's AirPods success on 16 September. Fresh noisy-room/barge-in and Safari/Firefox checks remain outstanding.

Submission draft is saving on lablab; cover, PDF deck and narrated walkthrough are being prepared. A transient lablab draft error cleared after refresh. In-app browser click/screenshot coordinates became inconsistent on old tabs; fresh tabs restored correct interaction. Documentation and linked Obsidian project notes updated with the release scope and evidence boundaries. Commit/push and final submission outcome are recorded below when completed.

### Release publication checkpoint

The final public browser preview reached explicit confirmation DEMO-060F773A. The 390 px layout had no horizontal overflow or page errors. Saved the cover, 141-second narrated screenshot walkthrough, six-slide PDF and editable deck in ignored `artifacts/submission/`; checked every rendered slide and PDF page. Scanned all 39 publishable working files and 88 historical Git blobs for the actual private provider key: no matches; no private environment file was tracked.

Version control decision: commit and push the verified release to the established public `Luo-Z-Y/gogocho-cinema` repository so judges can inspect and run the implementation. Generated media stays outside Git; public form uploads carry the submission assets. The final submission outcome follows separately.
