# Demo and verification checklist

Use a future date when rehearsing so the film has not already started. All times are Singapore time. No live provider test is claimed until a key is configured and a spoken journey is completed.

## Core journey

1. Ask for something light, under two hours, tomorrow, finishing before 22:00.
2. Expect The Last Table and Sideways Summer; the tool should preserve all constraints.
3. Ask about the difference in mood. Answers should use only the original catalogue and avoid spoilers.
4. Select The Last Table at 17:00 and two tickets.
5. Verify the review: correct date, Screen 1, ending 18:36, two tickets, S$24.
6. Press Confirm demo booking. Expect a DEMO reference and an explicit no-payment/no-reservation notice.

## Edge cases

- Request a tense film under 80 minutes: no match, with a request to relax a preference.
- Request The Last Table finishing before 18:36: no match; 18:37 does match.
- Change the ticket quantity: total and review must update before confirmation.
- Leave a review open for ten minutes: confirmation must reject it and ask for a fresh selection.
- Ask for a real film, cast member or award: the agent should explain that its programme is fictional.
- Interrupt mid-sentence: queued audio should stop, and the next reply should address the correction.
- Deny microphone access, remove the key, or disconnect: show an understandable state and release audio resources.
- End a conversation: send `session.end` and verify the browser microphone indicator turns off.
- Try a narrow viewport and keyboard-only navigation, including closing the dialogue with Escape.

## Before sharing publicly

The server currently accepts loopback access only. A public demo needs HTTPS, authentication or controlled access, persistent abuse/rate limits, and a deliberate provider-retention policy. Recheck event requirements and submission time on the event page; the project notes record 30 September 2026 at 23:00 Singapore time as the previously inspected deadline.
