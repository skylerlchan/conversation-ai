# Argus — 2-Minute Demo Storyboard

Created: 2026-06-06 18:19 PDT
Event: YC Conversational AI Hackathon (hosted by Moss, F25), June 6–7, 2026
Presenters: Edison + Skyler · Runtime: 2:00 · Format: **live** call performed on stage (real speech → live transcript → live Moss)
Concept evolved from the [diligence-call-copilot-plan.md](diligence-call-copilot-plan.md); demo content from the [CAVA fixtures](../agent-py/demo/).

**Argus** — proactive AI for buy-side analysts on live calls. It knows your filings and model
cold, listens to the call, and proactively tells you the detail that's getting buried and the
question to force it out. Silent, never trades. Swap-ready name alts: *Covera · Acuity · Edge*.

---

## The framing (read this first)

Three decisions, locked:

1. **Proactive, not reactive.** Argus doesn't track a checklist you brought — it has its *own*
   view of what matters (from your filings, model, last 4 calls) and surfaces the question you
   *hadn't* thought of. The wow is "the AI asked the thing I'd have missed."
2. **Narrow = the moat, not a limit.** A general meeting bot can't be proactive-useful — it
   doesn't know a 50bps margin gap matters or that "low-teens" contradicts a 12% model. Argus
   can, *because* it's finance-narrow and grounded in your documents. Domain grounding is what
   licenses the proactivity. That's the answer to "isn't this just Granola for calls?"
3. **The demo is genuinely live.** Real voice → LiveKit STT transcript streaming on screen →
   Moss ingesting + retrieving every turn in real time → Argus cards. Nothing faked. That is
   the wow *and* the cleanest proof of Moss's "retrieval is the bottleneck" thesis.

Surface: **earnings calls + management/expert meetings.** Stage demo is a two-way management
call (so the proactive question gets asked live and the loop closes on camera).

---

## On screen during the demo (the live layout)

- **Left — Live transcript** (LiveKit STT): words stream in as the CFO speaks.
- **Center — Moss indicator**: pulses "ingesting → retrieving" as each turn finalizes.
- **Right — Argus card rail**, appearing in real time:
  - `What matters now` — the grounded detail/context (Moss hit against the 10-K / model)
  - `Ask this` — the proactive, gap-closing question
  - `Flag` — contradiction vs the filing
  - `Tone` — the one sentiment beat

---

## Storyboard (shot list)

| # | Time | On screen | Who | Line |
|---|------|-----------|-----|------|
| 1 | 0:00–0:13 | Two of us on camera, tight | **Skyler** | "You're in a conversation that matters. The other side is talking fast — and the one detail that moves everything slips by. By the time you think of the question, the moment's gone." |
| 1 | 0:13–0:26 | "$10M" / a ticker | **Edison** | "For a hedge fund, that's an earnings call — an hour of management talking, the number that moves the stock buried, and no one can cross-check the filings and ask the right question in real time." |
| 2 | 0:26–0:35 | Cut to **Multiplier** UI | **Skyler** | "That's who we build for — founding engineers at WithAI. We make Multiplier, the workbench buy-side analysts use every day." |
| 3 | 0:35–0:48 | Argus panel docks; grounding corpus loaded | **Edison** | "So we built Argus. It knows your filings cold, listens live, and proactively tells you what to ask — to force out the detail they're burying. Never speaks, never trades." |
| 4 | 0:48–1:02 | **Live transcript streaming**; Moss indicator pulsing | **Skyler** | "This is live. As the CFO talks, LiveKit transcribes and Moss ingests every word — sub-ten-millisecond retrieval against the 10-K and our model." |
| 4 | 1:02–1:10 | CFO audio (recorded clip) plays; transcript fills | *CFO (audio)* | "…the new classes are opening strong, returns are healthy, low-teens cash-on-cash — one of the best new-unit stories in the group." |
| 4 | 1:10–1:20 | `Ask this` card fires, grounded in the model | **Edison** | "He glided past the number. Argus catches it, pulls our model — $2.6M AUV — and writes the question." |
| 4 | 1:20–1:30 | Skyler **speaks live**; his words hit the transcript | **Skyler (live)** | "What's the 2024 class actually opening at?" → *CFO audio:* "…call it around $2.4M." → "The number he wasn't going to volunteer." |
| 4 | 1:30–1:42 | `Flag` (red) + `Tone` cards fire | **Edison** | "Two flags. He says growth was price — filings say traffic: contradiction. And his tone tightens on margins. Argus calls it — confidence just dropped. That's the tell." |
| 4 | 1:42–1:50 | `Ask this` nudge on the uncovered topic; notes panel updates | **Skyler** | "One topic never came up — Argus surfaces it before time's out. Every detail out, and the notes write themselves." |
| 5 | 1:50–1:54 | Sponsor logos light along the pipeline | **Edison** | "Unsiloed parsed the filings, Moss retrieves live, MiniMax reasons and reads the tone — governed through TrueFoundry on AWS, a Qwen cue in your ear." |
| 6 | 1:54–2:00 | Cut to **Multiplier** with Argus docked; logo card | **Skyler** | "And Argus isn't a demo — we ship it inside Multiplier, to the funds already paying us. Never let the detail that mattered slip by." |

---

## Clean run-through (teleprompter — ~265 narration words + ~15s live audio ≈ 2:00)

> **SKYLER:** You're in a conversation that matters. The other side is talking fast — and the one detail that moves everything slips by. By the time you think of the question, the moment's gone.

> **EDISON:** For a hedge fund, that's an earnings call — an hour of management talking, the number that moves the stock buried, and no one can cross-check the filings and ask the right question in real time.

> **SKYLER:** That's who we build for — founding engineers at WithAI. We make Multiplier, the workbench buy-side analysts use every day.

> **EDISON:** So we built Argus. It knows your filings cold, listens live, and proactively tells you what to ask — to force out the detail they're burying. Never speaks, never trades.

> **SKYLER:** This is live. As the CFO talks, LiveKit transcribes and Moss ingests every word — sub-ten-millisecond retrieval against the 10-K and our model.

> *[CFO audio]:* "…the new classes are opening strong, returns are healthy, low-teens cash-on-cash — one of the best new-unit stories in the group."

> **EDISON:** He glided past the number. Argus catches it, pulls our model — $2.6M AUV — and writes the question.

> **SKYLER (live, into the call):** "What's the 2024 class actually opening at?" *[CFO audio: "…around $2.4M."]* — The number he wasn't going to volunteer.

> **EDISON:** Two flags. He says growth was price — filings say traffic: contradiction. And his tone tightens on margins. Argus calls it — confidence just dropped. That's the tell.

> **SKYLER:** One topic never came up — Argus surfaces it before time's out. Every detail out, and the notes write themselves.

> **EDISON:** Unsiloed parsed the filings, Moss retrieves live, MiniMax reasons and reads the tone — governed through TrueFoundry on AWS, a Qwen cue in your ear.

> **SKYLER:** And Argus isn't a demo — we ship it inside Multiplier, to the funds already paying us. Never let the detail that mattered slip by.

---

## Sponsor coverage (all 7)

| Sponsor | Role in the live demo | Spoken in |
|---|---|---|
| **LiveKit** | Carries the live audio + streams the STT transcript on screen | Scene 4 |
| **Moss** (host) | **Ingests every turn live**; sub-10ms retrieval grounds the proactive surfacing — the hero | Scene 4 + 5 |
| **MiniMax** | The brain — decides what matters, writes the proactive question, reads the tone | Scene 4 + 5 |
| **Unsiloed** | Parsed the 10-K + model into the grounding corpus (offline) | Scene 5 |
| **TrueFoundry** | Gateway over every model call — routing + audit log (the buy-side compliance hook) | Scene 5 |
| **AWS** | Hosts the agent + console, stores corpus + audit logs | Scene 5 |
| **Qwen** | Earpiece cue — the one place Argus "speaks," never on the call | Scene 5 |

Demo content reuses the [CAVA fixtures](../agent-py/demo/): the AUV dodge, the traffic-vs-price
contradiction, the tone shift, and the uncovered-topic nudge are all there — reframed from
"coverage of a pre-loaded list" to "proactive surfacing + question generation."

---

## Production notes (the live demo is the whole thing — protect it)

- **What's real vs locked.** STT + Moss ingestion + retrieval run **genuinely live** — that's
  non-negotiable and it's what sells it. For reliability, the **CFO's lines are a locked
  recording** piped into the LiveKit room (real audio → real STT → real Moss); the **analyst's
  one follow-up is spoken live** on stage. Be honest if asked: the *processing* is live; the
  counterpart audio is pre-recorded so the stage demo can't fail on a mic.
- **Lock the audio early.** Record the CFO clip from the CAVA `researcher` lines; it's the spine
  of the demo. Trim to ~15s total across the two playbacks so the run fits 2:00.
- **Show Moss working.** The pulsing "ingesting → retrieving" indicator and the transcript
  filling in real time are the proof. Keep them on screen and visible — don't crop them out.
- **Pace the beats.** Give the `Ask this` card a half-second to land before Skyler asks it, and
  let the `Tone` flag sit. The single sentiment beat only works if you don't rush it.
- **Rehearse to 2:00.** Narration is ~265 words; with ~15s of call audio you're at ~2:10 cold —
  trim the stack line first if you run long.

## Confirm before recording

- "Founding engineers at WithAI" + the P26 framing — phrase it the way it's actually true.
- "$10M call" / "funds already paying us" — keep directional; no named clients on camera.
- "Green light to ship inside Multiplier" — confirm the permission is current before stating it
  as fact on a recorded, possibly-shared demo.
- The CFO clip + numbers are **synthetic** (CAVA fixtures) — keep the on-screen disclaimer.
