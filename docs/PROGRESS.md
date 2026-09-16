# Progress

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
