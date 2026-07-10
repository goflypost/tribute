# Listen

**Question:** What happens when I typo, submit blanks, or hit back mid-flow?

## Mission

Find the app's primary form or input surface. Then, in order: (1) submit it
empty, (2) submit it with a typo'd email or malformed value, (3) fill it
partially and press the browser back button, then return. Record how the app
responds to each: error messages (helpful? blaming? absent?), preserved or
lost input, crashes, silent failures. Malformed input means typos and blanks —
never scripts, injection payloads, or load testing.

Max 25 actions.

## Scoring anchors

- **5** — The app hears you: inline, specific, kind error messages; input
  preserved across mistakes and back-navigation; impossible states prevented
  rather than punished.
- **4** — Good handling with a gap: errors are correct but generic, or one
  field loses state on back-navigation.
- **3** — Adequate: validation exists and prevents bad submissions, but
  messages are terse, placement is wrong, or partial input is lost.
- **2** — The app ignores you: silent failures, submitted blanks accepted,
  error text that blames the user or exposes internals (stack traces, raw
  error codes).
- **1** — Mistakes break the app: crashes, corrupted state, or a form that
  can never be completed once an error occurs.
