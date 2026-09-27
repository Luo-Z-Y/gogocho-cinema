# Demo rehearsal

Public: https://gogocho-cinema.vercel.app . Local: http://127.0.0.1:3000 . All times are Singapore time and all bookings are fictional.

## Spoken journey

1. Press Start talking and allow the intended microphone.
2. Say “Something light tomorrow, under two hours, finishing before ten at night.” Check tomorrow/light/under two hours/22:00 on screen.
3. Say “Please compare Sideways Summer and The Last Table on screen, keeping all my preferences.” Check both films, original tone notes and their matching times.
4. Say “Two tickets for The Last Table, please.” Check the actual date, 17:00 start, 18:36 finish, Screen1, two tickets and S$24.
5. Press Confirm demo booking. Check a DEMO reference. Only now may the agent describe a confirmed demo.
6. Try Save demo to calendar. Check the downloaded calendar says DEMO/TENTATIVE, has correct UTC times and no real reservation claim.
7. End the conversation. Check capture/playback stop and the input device indicator clears.

Public calls last at most three minutes. Token starts have an IP limit of three per ten minutes plus browser/process backstops. Do not hold a paid session open to wait for expiry tests.

## Guided and manual journey

Try a preview starts a labelled scripted walkthrough without microphone permission or a provider session. Find films, compare the two, choose The Last Table and explicitly confirm. Manual filters and + Compare should produce the same validated results. Remove Finish before with × to return to Any time while preserving other filters.

## Boundary checks

- Strict cutoff: The Last Table fails before18:36 and fits before18:37 on a future date.
- No match: retain constraints and offer to change one, never fabricate a screening.
- Comparison: a non-matching film has no bookable screening.
- Quantity: 1–6 only. Changing the review invalidates the previous quote.
- Expiry/tampering: stale, altered or other-session reviews cannot confirm.
- Voice: microphone denial, muted input, interruption and disconnect release resources.
- Narrow viewport: no horizontal overflow, controls remain usable and dialogues scroll.

## Evidence on 27 September 2026

Automated: 26 tests and syntax/catalogue checks pass. Live generated-speech journey: pass, all three tools and explicit API confirmation, with original AirPods evidence separately dated16September. Public browser guided flow: pass through an explicit confirmation click. Calendar generation: unit pass, completed browser download unverified because the observer timed out. Typed follow-ups: inconsistent, controls withheld. Fresh physical microphone/noise/interruption and Safari/Firefox checks remain pending.

For each new run record timestamp, version, browser/input, exact request, selected date/constraints, review details, confirmation action, cleanup, outcome and remaining limitations. Never store tokens, credentials or personal speech in evidence. Full history: [PROGRESS.md](PROGRESS.md).
