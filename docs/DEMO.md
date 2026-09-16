# Demo and verification checklist

Use a future date when rehearsing so the film has not already started. All times are Singapore time. Live token issuance, session configuration and greeting audio/transcript were verified on 16 September 2026. A generated phrase has since passed live browser transcription, and the user confirmed an AirPods conversation works. The complete booking journey below still needs a spoken run.

## Evidence rules

- Run this checklist against a known commit and record the browser, operating system, microphone and actual Singapore screening date. “Tomorrow” in a transcript alone is not a reproducible date.
- Label the method: automated/simulated, manual local browser, live provider or user-reported. A mocked interruption test does not establish live interruption quality.
- The 16 September documentation checkpoint reran all 17 automated tests and the syntax/catalogue checks successfully. It did not rerun browser or live-provider checks. Earlier results and their limits are in [the progress log](PROGRESS.md).
- A live core-journey pass requires spoken discovery and selection, the correct on-screen review, an explicit confirmation click, a DEMO reference and microphone release. Greeting audio or an opened review alone is not a pass.
- Record failures and blocked steps, not only successful runs. Do not include keys, temporary tokens, cookies, `.env` contents or personal conversation details in screenshots or notes. No raw microphone recording is required.

## Core journey

1. Ask for something light, under two hours, tomorrow, finishing before 22:00.
2. Expect The Last Table and Sideways Summer; the tool should preserve all constraints.
3. Ask about the difference in mood. Answers should use only the original catalogue and avoid spoilers.
4. Select The Last Table at 17:00 and two tickets.
5. Verify the review: correct date, Screen 1, ending 18:36, two tickets, S$24. It must still be awaiting confirmation; spoken agreement must not confirm it automatically.
6. Press Confirm demo booking. Expect a DEMO reference and an explicit no-payment/no-reservation notice.
7. End the conversation and verify the browser microphone indicator turns off.

## Edge cases

- Finish before starts at Any time with no limit. Click it and enter 18:37 on a future date; screenings finishing at or after that time must be excluded. Use the × (accessible name: Any time — remove finish-time limit) and submit: later screenings should return while the other filters stay selected. The field and filter row must keep their height in both states, with keyboard focus moving into the time input and back to Any time on clearing. Reset filters must also restore Any time. A simulated voice search with an arbitrary minute must reveal that exact time; one without endBefore must restore Any time. This browser check does not establish live-agent preference handling.
- After comparing films, select one without repeating the date, mood, runtime or finish-time preferences: the agent should retain the relevant constraints rather than silently drop them.
- Use an unclear or partial title that does not uniquely identify a film: the agent should clarify before selecting a screening or opening a review, not invent a film or identifier.
- Request a tense film under 80 minutes: no match, with a request to relax a preference.
- Request The Last Table finishing before 18:36: no match; 18:37 does match.
- Change the ticket quantity: total and review must update before confirmation.
- Leave a review open for ten minutes: confirmation must reject it and ask for a fresh selection.
- Ask for a real film, cast member or award: the agent should explain that its programme is fictional.
- Interrupt mid-sentence: queued audio should stop, and the next reply should address the correction.
- Try ordinary background noise: record transcription and response quality; the agent should clarify uncertain selections rather than silently choosing the wrong film or quantity.
- Open Microphone and run Test mic: silence should report no sound; speaking should move the bars and report input. The six-second test must release the microphone without opening a provider session.
- Switch microphone during a conversation: capture should move to the selected device without starting another provider session.
- Deny microphone access, remove the key, or disconnect: show an understandable state and release audio resources.
- End a conversation: send `session.end` and verify the browser microphone indicator turns off.
- Try a narrow viewport and keyboard-only navigation, including closing the dialogue with Escape.

## Next live-run tracker

All statuses below refer to the next recorded live/manual rehearsal. “Pending” does not erase earlier automated or simulated browser evidence.

| Scenario | Completion evidence | Status |
| --- | --- | --- |
| Core spoken journey | Preserved constraints; correct dated review, Screen 1, 18:36, two tickets, S$24; explicit click; DEMO reference; microphone released | Pending |
| Preference carry-over and ambiguous titles | Follow-up retains relevant constraints; unclear selection prompts clarification | Pending |
| No-match and strict finish boundary | No invented result; before 18:36 rejects The Last Table, before 18:37 accepts it on a future date | Pending |
| Quantity changes | Review and total update; older review cannot be confirmed | Pending |
| Catalogue grounding | Discussion uses original catalogue; real-film requests do not produce invented real listings | Pending |
| Interruption and noisy audio | Playback stops on interruption; reply addresses correction; uncertain input is clarified | Pending |
| Microphone and failure recovery | Local Test mic uses no token; selected input works; denial/disconnect/end release resources | Pending |
| Browser/accessibility rehearsal | Narrow viewport and keyboard journey work; record browser/version, with Safari/Firefox checked separately | Pending |

Use one session for related live scenarios where practical: the local process allows five start attempts per hour and each session is capped at ten minutes. Run the ten-minute review-expiry check without keeping a paid conversation open solely to wait. Record a rate-limit or credit block as **blocked**, not as a successful scenario or a confirmed provider outage.

## Run-record template

Copy this block below for each actual rehearsal and fill it from observations. This unfilled template is not evidence of a run.

```text
Run ID and timestamp (timezone):
Commit / uncommitted changes:
Method: automated/simulated | manual local browser | live provider | user-reported
Environment: URL, OS, browser/version, microphone/input route
Screening date (YYYY-MM-DD, Asia/Singapore):
Scenario and exact spoken/typed steps (redact personal details):
Expected result:
Observed result (include filter/date/film/quantity values where relevant):
Confirmation state before and after the visitor's click:
Microphone/audio cleanup:
Outcome: pass | fail | blocked | partial
Failure reproduction / evidence location, if any (no credentials or tokens):
Fix and regression checks, if applicable:
Live retest result, if applicable:
Remaining risk and next action:
```

After a run, update the relevant tracker row and add a dated result to `docs/PROGRESS.md` and the Obsidian progress log. Update the README and project plan if the overall milestone changes. Distinguish an observed fix from a fix awaiting live retest.

## Before sharing publicly

The server currently accepts loopback access only. A public demo needs HTTPS, authentication or controlled access, persistent abuse/rate limits, a provider spending/session policy, and a deliberate provider-retention policy. Check the credit balance separately; working API access does not establish available credits. Configure a repository remote only when its destination is established and authorised, and check the deployed booking and microphone journey before sharing the URL.

Recheck event requirements and submission time on the [event page](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) and submission form. The project notes record 30 September 2026 at 23:00 Singapore time as the previously inspected deadline, with an MP4 of at most five minutes and PDF slides among the submission materials. None of these event details was rechecked during the documentation checkpoint. Do not mark deployment or submission complete without an actual accessible demo or submission confirmation.
