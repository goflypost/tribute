# Tune Up boundaries

Written down before the first run, because the moment Tribute's agent causes a
builder real cleanup work, the "volunteer as tribute" loop dies. The whole
pitch is that the Tune Up is a service you want.

1. **Consent.** The agent only tests apps that volunteered, or public flows on
   the inaugural cohort. It does not create accounts on apps that didn't
   consent.
2. **Payment is a wall.** The agent stops at paywalls and payment forms,
   period. The harness independently refuses to type into any field that
   looks like a payment detail (see `agent.ts`).
3. **Test identity only.** Name "Tribute Agent", email
   `tribute-agent@tribute.invalid`, obviously-fake values elsewhere. Never
   real PII. `.invalid` is reserved (RFC 2606) and can never deliver mail.
4. **"Break things" means malformed input.** Typos, blanks, back-navigation.
   Never scripts, injection payloads, fuzzing, load testing, or anything
   resembling an attack. The harness stays on the target site — offsite
   navigation is refused in code.
5. **Leave no mess.** One pass, one account at most, no public posts, no spam.
6. **Human-in-the-loop.** The agent writes a draft. A human reads it, corrects
   it, and signs it (`humanReview.reviewed: true` + reviewer name) before
   anything touches the register. No public misjudgment ships unsigned.
   Automation graduates when the human edit rate on drafts approaches zero —
   that number, not a date, is the criterion.
