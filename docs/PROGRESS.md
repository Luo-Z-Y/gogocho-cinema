# Progress

## Current status — 16 September 2026

**Stage: local prototype working; end-to-end live demonstration pending.** The programme, demo booking and voice integration are implemented. Live API access and an AirPods conversation have been established, but a complete spoken discovery-to-confirmation journey has not been verified.

The latest entry below records the detailed readiness checkpoint, fresh automated results, outstanding risks and completion criteria. Earlier entries are historical: statements such as “live voice remains unverified” describe that earlier checkpoint, not the current state. Use [the demo checklist](DEMO.md) to record the next live run.

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
