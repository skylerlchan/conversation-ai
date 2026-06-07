# Brox — Demo (v2, story-first rewrite)

Created: 2026-06-06 22:40 PDT
Event: YC Conversational AI Hackathon (hosted by Moss, F25), June 6–7, 2026
Presenters: Edison + Skyler · Runtime: 2:00 · Format: **live** call performed on stage
Supersedes [demo-storyboard.md](demo-storyboard.md) (the "Brox / earnings-call" v1). Same engine + CAVA
fixtures; rewritten against the YC *Good Demo / Bad Demo* criteria, reframed to the **expert call + the clock**.

---

## The one sentence

**Brox is the analyst in your ear on a $1,200 expert call — it knows your model cold, watches the
clock, and forces out the one number your whole thesis depends on before the hour runs out.**

## Main character (say this out loud — don't assume it's obvious)

**Maya, a buy-side analyst.** She's long CAVA. Her entire thesis rests on one number: new units opening
at **$2.6M AUV**. To check it, she bought *one hour* with a **former CAVA regional operator** through an
expert network — it costs her fund **$1,200**, and she'll get maybe one of these on this name all quarter.
The expert loves to talk. The clock is the enemy. **The role we play in the demo is Maya.**

## The magic moment (the ONE thing they'll repeat to a colleague)

8 minutes in, the operator glides past the AUV number with a warm non-answer — *"honestly one of the best
new-unit stories in the group."* **Brox catches the dodge, grounds it against Maya's own model ($2.6M),
and writes the exact question in her ear.** She asks it. He gives the real number: **$2.4M, not $2.6.**
Her model moves on screen. The AI caught the one number that mattered being buried — *with the receipt* —
while the clock ate her call. Everything else in the demo exists to set up or pay off this beat
(Chekhov's gun).

---

## On screen (the live layout)

- **Top — the clock.** A live call timer: `⏱ 52:00 LEFT` ticking down. This is the spine. It never leaves.
- **Left — Must-ask, ranked by what your model needs most.** Not a checklist Maya brought — Brox's own
  ranking by model impact. Each card carries *why her model is exposed*:
  - `① New-unit AUV ramp` — *drives ~40% of unit-growth NPV · confidence: LOW · still unasked* (glowing red)
  - `② Restaurant-margin durability` — *±300bps = ±$0.40 EPS*
  - `③ Traffic vs price (comp quality)` — *premium multiple rides on this*
- **Center — live transcript** (LiveKit STT) + the **Moss** indicator pulsing *ingesting → retrieving*.
- **Right — Brox cards**, firing in real time: `Ask this` (the gap-closer), `Flag` (contradiction vs her note).

---

## Storyboard — shot list (cold open first; show, then tell)

| # | Time | On screen | Who | Line |
|---|------|-----------|-----|------|
| **COLD OPEN — the magic, no setup** |
| 1 | 0:00–0:11 | Console mid-call. `⏱ 52:00` ticking. `①` glowing red/unasked. Operator audio rambling about menu culture | **Skyler** | "She's 8 minutes into a 60-minute expert call. It's costing her fund twelve hundred dollars — and she's about to waste it." |
| 1 | 0:11–0:22 | Operator audio: *"…the new classes are opening strong — honestly one of the best new-unit stories in the group."* `Ask this` card fires | **Edison** | "He just glided past the one number her whole thesis rests on. Brox caught it — grounded in *her* model, $2.6M AUV — and wrote the question." |
| 1 | 0:22–0:34 | **Skyler speaks live** into the call; his words hit the transcript | **Skyler (live)** | "What's the 2024 class actually opening at?" → *operator audio:* "…call it around $2.4M, not 2.6." → model row updates red |
| 1 | 0:34–0:40 | `①` flips green; model delta animates `$2.6M → $2.4M` | **Edison** | "There it is. The number he wasn't going to volunteer — and her model just moved. **That's Brox.**" |
| **THE TELL — now explain it** |
| 2 | 0:40–0:54 | Pull back to full layout; Moss indicator + clock highlighted | **Skyler** | "Here's how. Brox knows Maya's filings and model cold. LiveKit transcribes live, Moss retrieves the matching assumption in milliseconds, and it surfaces only what her model can't survive without — ranked by impact, against the clock." |
| 3 | 0:54–1:06 | The must-ask rail, ranked | **Edison** | "Every quarter Maya buys a handful of these. The expert always talks; the clock always wins; the question she needed hits her in the parking lot. Brox is the analyst in her ear that never forgets the model and never loses the time." |
| **SECOND PUNCH + resolution** |
| 4 | 1:06–1:22 | Operator audio: *"…most of the comp's been price, traffic's roughly flat."* `Flag` (red) fires | **Skyler** | "Second catch. Her note models *traffic-led* comp — he just said price-led. That breaks the premium-multiple case. She'd have nodded right past it." |
| 5 | 1:22–1:34 | Clock at `~38:00`. Board: 4 of 5 model-critical answered; last one grey → Brox nudge | **Edison** | "And it won't let her hang up with a model-critical question still open." |
| 6 | 1:34–1:44 | One click → **cited call memo + model deltas** (`AUV $2.6→2.4`, `comp: traffic→price`) | **Skyler** | "She leaves with a sourced memo and an updated model — not a vibe. Every line links to the moment it was said." |
| **STACK + close (one breath — don't tour it)** |
| 7 | 1:44–1:53 | Sponsor logos light along the pipeline once | **Edison** | "LiveKit carries the call, Moss retrieves live — the hero — MiniMax reads the dodge, Unsiloed parsed her filings, governed through TrueFoundry on AWS." |
| 8 | 1:53–2:00 | Cut to Multiplier with Brox docked | **Skyler** | "Brox ships inside Multiplier, to funds already paying us. **Buy the hour. Don't waste it.**" |

---

## Teleprompter (~250 narration words + ~15s operator audio ≈ 2:00)

> **SKYLER:** She's 8 minutes into a 60-minute expert call. It's costing her fund twelve hundred dollars — and she's about to waste it.

> *[OPERATOR audio]:* "…the new classes are opening strong — honestly one of the best new-unit stories in the group."

> **EDISON:** He just glided past the one number her whole thesis rests on. Brox caught it — grounded in *her* model, $2.6 million AUV — and wrote the question.

> **SKYLER (live, into the call):** "What's the 2024 class actually opening at?" *[operator audio: "…around $2.4 million, not 2.6."]*

> **EDISON:** There it is. The number he wasn't going to volunteer — and her model just moved. That's Brox.

> **SKYLER:** Here's how. Brox knows Maya's filings and model cold. LiveKit transcribes live, Moss retrieves the matching assumption in milliseconds, and it surfaces only what her model can't survive without — ranked by impact, against the clock.

> **EDISON:** Every quarter Maya buys a handful of these. The expert always talks; the clock always wins; the question she needed hits her in the parking lot. Brox is the analyst in her ear that never forgets the model and never loses the time.

> **SKYLER:** Second catch — her note models traffic-led comp; he just said price-led. That breaks the premium-multiple case. She'd have nodded right past it.

> **EDISON:** And it won't let her hang up with a model-critical question still open.

> **SKYLER:** She leaves with a sourced memo and an updated model — not a vibe.

> **EDISON:** LiveKit carries the call, Moss retrieves live, MiniMax reads the dodge, Unsiloed parsed her filings, governed through TrueFoundry on AWS.

> **SKYLER:** Brox ships inside Multiplier, to funds already paying us. Buy the hour. Don't waste it.

---

## The clock — how to make 60 minutes believable in 2 minutes

The timer is the emotional spine, so it has to read true:

- **Join late.** Open at **`52:00 LEFT`** ("8 minutes in") — the user's framing. We're showing the decisive
  stretch of the hour, not minute one.
- **It's call-time, not wall-clock.** The on-screen clock is choreographed to the edited clip; over ~90s of
  stage time it ticks from `52:00` to `~38:00`. Don't dwell on the math — nobody stopwatches it, and the
  *felt* truth (minutes burning on the wrong things) is what lands.
- **The scarcity is "wasted minutes," not "call about to end."** Stronger and more honest than an
  end-of-hour panic: the alarm is *"you've burned 8 minutes and your #1 is still open,"* which is exactly
  *"ask these because your model needs them most."*
- **Optional alt-climax:** a late red `⏱ 6:00 LEFT — 1 model-critical question still open` alarm + earpiece
  cue. Use it only if the run has room; the AUV catch is already the magic moment, don't dilute it.

## What's real vs staged (be honest if asked — it makes it *more* impressive)

- **Genuinely live:** STT, Moss ingestion + retrieval, and Brox's surfacing all run live. That's the proof
  and it's non-negotiable.
- **Staged for reliability:** the **operator's lines are a locked recording** piped into the LiveKit room
  (real audio → real STT → real Moss); **Maya's one follow-up is spoken live** on stage. The processing is
  live; the counterpart audio is pre-recorded so a mic can't kill the demo.
- **Synthetic data, real brand.** CAVA is real; the operator, the "Meridian" note, and the numbers are
  synthetic fixtures. Keep the on-screen disclaimer. The numbers are *realistic* — no lorem ipsum, no
  round-number tells.

## Instant-on (spin it up in seconds)

Spine is the scripted expert call that hits the beats every time — runs through the existing runner with
zero setup. See [live-demo-runbook.md](live-demo-runbook.md). One change for v2: reskin the counterpart in
[cava_call.md](../agent-py/demo/cava_call.md) from "sell-side researcher" to **former CAVA regional
operator** (same beats — AUV dodge, traffic-vs-price, catering nudge — a better-sourced voice for unit
economics) and regenerate the audio.

---

## Why this satisfies the criteria (the rewrite checklist)

| Criterion | v1 (earnings/Brox) | v2 (this) |
|---|---|---|
| **Story, not tour** | opened on setup + a 7-sponsor pipeline | opens *in* the scene; named main character (Maya) with a problem; sponsors are one breath at the end |
| **One magic moment** | several beats competed (dodge, tone, flag, nudge) | one hero beat — the AUV dodge forced out with the receipt; everything else sets it up or pays it off |
| **Believable** | numbers stated, lightly grounded | the catch is grounded in *her* $2.6M model and lands on a real $2.4M; show-then-tell so skeptics see the how |
| **Tailored** | generic "buy-side analyst" | a specific analyst, a specific thesis ($2.6M AUV), CAVA's real brand; Moss (the host) is the visible hero |
| **Engaging** | narration-heavy | live follow-up spoken on stage; the clock creates real tension |
| **Instant-on** | live, fragile | scripted-call spine hits the beats every time; one command |
| **Show, then tell** | told the architecture first | magic in the first 11 seconds; architecture only after |

---

## Confirm before recording

- "Founding engineers at WithAI" / "funds already paying us" / "ships inside Multiplier" — state only what's
  currently true on a recorded, shareable demo. No named clients on camera.
- Keep the **synthetic-fixtures** disclaimer visible (CAVA brand real; operator + numbers illustrative).
