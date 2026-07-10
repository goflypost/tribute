# Tribute

**The web, without the untested apps.**

Thousands of vibe-coded apps ship every day. Most were never used by a human
before launch — not even by the person who prompted them into existence.
Tribute appraises them in place, right where you discover them, so what's left
is software that survived a real customer journey.

*"I volunteer as tribute."*

Inspired by [Knockoff](https://knockoff.shopping), which does this for
pseudo-brands on Amazon. Tribute does it for vibe-coded software everywhere
apps get launched.

## How it works

Tribute is a browser extension plus an appraisal pipeline. Every app listing
you encounter — starting with Show HN — is appraised in place:

**1. Checked against the register.**
A curated register of apps that have passed a Tribute Tune Up. Verified apps
pass untouched and wear a laurel. Apps with a reputation to lose.

**2. Unknowns get scored.**
Untested vibe-coded apps have a signature: default favicons, placeholder copy,
dead links, broken OG tags, no pricing or about page, default `*.vercel.app`
domains, "made with" badges, pages that render blank without JavaScript.
Tribute scores every unknown app against it, cheaply, without deep testing.

**3. You set the strictness.**
Flagged listings are hidden, dimmed, or just labeled — your call. Every
verdict is one click from being overridden. Your personal trust and block
lists beat every other signal, always.

**4. Builders volunteer as tribute.**
The way onto the register is the Tune Up: an agentic reviewer walks your app's
entire customer journey and scores it. Pass, and every Tribute install stops
flagging you within a day.

## The Tune Up

The Tune Up is a customer-journey review modeled on the Apple Steps of
Service, adapted for software. An agent actually uses the app — clicks through
flows, submits forms, breaks things — and scores five stages:

| Stage | Question it answers |
|---|---|
| **Approach** | Do the first five seconds tell me what this is and why I'd care? |
| **Probe** | Does onboarding learn what I need, or dump me somewhere empty? |
| **Present** | Can I accomplish the core thing? How many steps, how many dead ends? |
| **Listen** | What happens when I typo, submit blanks, or hit back mid-flow? |
| **End** | Is there a confirmation, a farewell, a reason to return — or does the journey just stop? |

Every score ships with explainable reasoning ("Probe: 2/5 — no onboarding,
first screen is a settings page"). The output is a service report, not a
takedown. The goal is software that treats its users well — and a register
that proves it.

## Status

Pre-alpha. Nothing works yet. The build order:

1. **The rubric** — scoring criteria for the five stages (`rubric/`)
2. **The register** — schema and seed data (`register/`)
3. **Heuristics** — cheap static signals for unknown apps (`heuristics/`)
4. **The Tune Up pipeline** — agentic journey testing (`tuneup/`)
5. **The extension** — Show HN content script first, then Product Hunt and
   beyond (`extension/`)

### Inaugural cohort

The first five Tune Ups, drawn live from Show HN, chosen to stress-test the
rubric across very different journey shapes:

- **LastShelf** — consumer, high-trust, journey-heavy (trial, onboarding, quiz)
- **Lucid** — novel-concept AI tool that lives or dies in the first 60 seconds
- **Devthropology** — SaaS demo-to-connect flow
- **Arcaide** — dev tool with a classically abrupt journey
- **hnwork.app** — a micro-utility, to prove the rubric scales down and
  doesn't punish simple apps for being simple

## Contributing

The untested-app arms race is only winnable together. Add heuristics, tune the
rubric, report misclassifications, or volunteer your own app as tribute. Every
fix ships to everyone.

## License

[FSL-1.1-MIT](LICENSE) — the Functional Source License with an MIT future
grant, the same fair-source license Knockoff uses. Free to use, copy, modify,
and redistribute for any purpose except building a competing product; converts
to plain MIT two years after each release.
