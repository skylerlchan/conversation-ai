# Diligence-Call Copilot — Hackathon Plan

Created: 2026-06-06 16:31 PDT
Event: YC Conversational AI Hackathon (hosted by Moss, F25), June 6–7, 2026
Repo: skylerlchan/conversation-ai · built on the Moss + LiveKit voice starter
Customer: buy-side hedge funds (the analyst / PM)
Working name: TBD ("Cover" / "Coverage" is a candidate — you never leave a call with a hole)

---

## The one-line pitch

A real-time copilot for a buy-side hedge fund analyst on a diligence call. You load the
**questions you need answered before the call**. As the researcher responds, the copilot
tracks **coverage of every question live**, feeds you the sharp follow-up the moment an
answer comes back thin, and makes sure you hang up with **zero holes** — then updates your
thesis notes from what you learned.

It is **WithAI for the live call**: a fund's research stack (briefs, workups, comps) is all
*async*, run before or after the moment. This fills the one gap where Moss wants to live —
the live call, when you need to know *is that question actually answered, and what do I ask
next* in real time. Moss's thesis is exactly this: *"voice is cheap and fast; retrieval is
the bottleneck."* ([Moss · YC](https://www.ycombinator.com/companies/moss))

## Who's on the call (two tracks, one brain)

The customer is always the **buy-side hedge fund**. The counterpart is the person they're
extracting marginal, unpublished knowledge from:

- **Buy-side ↔ equity research analysts (JPM, Goldman, etc.)** — the demo hero. Corpus is
  the analyst's published note + model + the company's filings + consensus. Legible to any
  judge; the gap between what's published and what the fund needs is crisp.
- **Buy-side ↔ academic researchers / industry labs** — the extension. Corpus is papers +
  technical primers + the lab's prior work. Cooler for a YC crowd (a fund grilling a
  scientist to diligence a deep-tech bet), but the "good question" bar is more technical.

Lead the demo with the equity-research call; show the academic track as "and the same brain
diligences deep tech."

## The core decision (read this first)

**The copilot listens on the analyst's side; it never speaks on the call and never trades.**
That single constraint keeps the safety story clean and buys three things at once:

- **No latency tax.** The copilot updates the analyst's screen while the researcher talks.
  A sub-second Moss lookup costs nothing because nobody waits on the AI to speak. This is
  the cleanest possible demonstration of Moss's "retrieval is the bottleneck" pitch.
- **Defensible.** No "can you trust an AI on a live call / to trade" objection — it does
  neither. It surfaces; the analyst acts.
- **Bigger wow.** Watching the question list tick green in real time, and the copilot
  refusing to let you forget the one thin answer, beats a bot holding a conversation.

Two premises this build rests on (confirmed in office hours):

1. **The pre-call question list is the wedge** — the copilot's job is *coverage + smart
   follow-ups on thin answers*, not inventing the agenda. The fund already knows what it
   needs; the copilot makes sure they get it.
2. **Real-time is load-bearing, not a gimmick.** A gap found after hang-up is a gap you
   can't fill. Catching it while the researcher is still on the line is the entire point.

---

## The spine: a coverage state machine

This is the whole product in one idea. Every pre-loaded question lives in one of three
states, and the copilot's only goal is to drive all of them to `answered`:

```
   unanswered ──researcher addresses it──►  partial ──follow-up closes it──►  answered
        │                                      │
        └────────── still not raised ──────────┘   (copilot keeps surfacing it)
```

- **answered (green)** — the question got a specific, gap-free answer. Tick it.
- **partial (amber)** — raised but vague, hedged, or dodged. The copilot generates the
  follow-up that closes it and surfaces it for the analyst to ask.
- **unanswered (grey)** — not yet covered. The copilot watches for the right moment and
  nudges before the call ends.

The demo "whoa": questions tick green live as the researcher talks, one stubborn amber sits
there, the copilot hands you the exact follow-up, you ask it, it goes green. You hang up
with everything covered.

## The three jobs (one brain, three outputs on screen)

1. **Coverage tracking (hero)** — map each researcher turn to the question(s) it addresses,
   score it, update the state machine. The list is always live and honest.
2. **Follow-up prompter** — on any `partial`, generate the sharpest next question to close
   it, grounded in your past notes and the specific gap. *"They said 'low-teens' but their
   note models 12% — ask them to reconcile the segment growth assumption."*
3. **Live grounding + inconsistency** — surface the relevant fact from your own research /
   the filing as the researcher speaks; flag when an answer contradicts their published
   model or something said earlier on this call.

Plus the close-the-loop step from your plan: **thesis / hypothesis update** — by hang-up,
the call's answers and flags are folded into an updated note (the "improve the database /
analysis / hypothesis based on context" box in your sketch).

## What gets surfaced live — the cards

| Live card | Real at a hackathon? | Plan | The wow |
|---|---|---|---|
| **Coverage list** | Real | Pre-loaded questions; each researcher turn re-scores state | The list ticks green as they talk |
| **Follow-up** | Real | On `partial`, LLM generates the gap-closing question grounded in past notes (Moss) | The exact question a senior analyst would ask, pre-written |
| **Grounding** | Real | Spoken claim → Moss RAG over Unsiloed-parsed notes/filings/papers → the source fact | Their own published number appears as they speak |
| **Inconsistency** | Real | Answer vs published model / vs earlier turn on this call | "Contradicts their note's margin bridge" |
| **Thesis delta** | Real | Extract what changed → update the hypothesis note | The call writes itself into your model assumptions |

Be honest about what's pre-loaded: the question list, the thesis, and (equity track) the
consensus table are structured inputs. In a real deployment they're a FactSet / internal
feed; pre-loading them for a 24h demo is the right call, not a cheat.

## How it works (matches your sketch)

```
   Diligence call   (analyst ⇄ researcher: equity or academic)
                 │ audio into the LiveKit room
                 ▼
        LiveKit STT  ── live transcript ──────────────────────┐
                 │ each finalized researcher turn               │
                 ▼                                              │
   LLM (MiniMax): which question did this answer? how well?     │   "skill context
   extract facts · score coverage · spot contradiction          │    based on the
                 │ fires tools in the BACKGROUND                ▼    conversation"
                 │ (NO TTS — the copilot never speaks on the call)
     ├─ score_coverage ─► update the question state machine  (call state)
     ├─ ground_answer  ─► relevant past-note / filing fact   via MOSS (Unsiloed-parsed)
     ├─ make_followup  ─► gap-closing question for any `partial`
     └─ update_thesis  ─► fold the answer into the hypothesis note
                 │ results as LiveKit data packets
                 ▼
   Analyst console:  coverage list · follow-up queue · grounding · thesis delta
                 │
                 ▼
   HUMAN analyst asks the follow-up / decides   (stays anchored to "our questions")
```

## Architecture (what changes from the starter)

The starter already gives a working voice loop, a Moss RAG + memory spine, and a
data-packet → frontend-panel path ([agent.py:125-161](agent-py/src/agent.py#L125-L161)).
We reskin and re-wire; we don't rebuild.

```
agent-py/  (Python LiveKit agent — the "Agents SDK" box in your sketch)
  src/agent.py        ── flip Assistant from talker → SILENT LISTENER:
                          • no greeting, no TTS to the room
                          • hook each finalized researcher turn (on_user_turn_completed)
                            → score coverage → fire tools → publish cards
                          • the COVERAGE ENGINE (the one genuinely new piece)
                          • load the pre-call question list at session start
  src/create_index.py ── feed it the call's corpus, not LiveKit docs
  knowledge.json      ── REPLACE corpus: Unsiloed-parsed research note + model + filings
                          (equity) OR papers + primers (academic); plus the question list
                          and the thesis memo

frontend/  (Next.js — the analyst console / output panel in your sketch)
  reuse the Moss "Knowledge Matches" panel  ── becomes the grounding feed
  add: Coverage list      ── the question state machine, green/amber/grey
  add: Follow-up queue     ── gap-closing questions
  add: Thesis delta        ── what the call changed
  app-config.ts            ── rebrand to "Diligence Copilot"
```

The Moss tool mapping (same indexes, new jobs):

| Starter tool | Becomes | Use here |
|---|---|---|
| `search_knowledge` (Moss `knowledge`) | **ground_answer** | Retrieve the past note / filing / paper fact for what the researcher just said, and to find the gap |
| `remember_fact` (Moss `memory`) | **call state** | Store each answer + coverage verdict + extracted facts, keyed to the question it addresses |
| `recall_facts` (per-user filter) | **question list + thesis recall** | Pull the fund's pre-call questions and thesis assumptions to score coverage and generate follow-ups |

Everything else (LiveKit transport, Inference for STT, Moss SDK, the per-call `user_id`
that scopes the question list + notes, the `moss_context` data-packet contract) stays as-is.
No new credentials beyond the LiveKit + Moss keys the starter already needs. **TTS is removed
from the room path** (the copilot is silent on the call); it returns only as an optional Qwen
earpiece cue (Tier 2).

## The coverage engine (the one genuinely new piece)

A small, explicit, structured LLM step that runs on
every researcher turn and is the heart of the demo. For each turn it returns:

```
{ addresses_question_id, coverage, extracted_facts, contradiction, followup }
coverage     ∈ unanswered | partial | answered
contradiction: null | { vs: "note" | "earlier_turn", detail }
followup:     null | "the gap-closing question to ask next"
```

Rules, kept explicit in code because the whole demo rides on them:
- A turn can advance multiple questions, or none.
- `partial` is the high-value state — it must reliably fire a *good* follow-up, grounded in
  the specific gap (Moss retrieval), not a generic "can you say more?"
- **Stay anchored to the fund's question list** (the "stick to our questions" note) — the
  copilot does not wander into questions the fund didn't ask for.
- When unsure between `partial` and `answered`, default to `partial`. Coverage gaps are the
  product; better to over-flag than to let a hole through.

## Sponsor integrations — where and how

Six sponsors plus Moss (host). One pipeline — parse → understand → score → ground → surface
— carries almost all of them, and the same pipeline is the real-world story (runs in the
fund's own governed cloud). ([sponsor research](research/hackathon-sponsors-judges-builds.md))

```
  BUILD-TIME (offline)
   Research note · model · filings · papers ──[UNSILOED parse]──► chunks ──index──► [MOSS]
   + the fund's pre-call question list + thesis memo                       (stored in [AWS] S3)
  LIVE CALL
   Researcher audio ──► [LIVEKIT] WebRTC + STT ── transcript ──┐
                                                               ▼
                       [TRUEFOUNDRY gateway] route·log ──► [MINIMAX LLM]  (score + tool calls)
                          (governs + audits every AI call)        │ tool calls
                                        ├─ score_coverage ─► state machine ([AWS])
                                        ├─ ground_answer   ─► [MOSS] semantic search
                                        └─ make_followup   ─► gap-closing question
                                                               │ results
                                                               ▼
                       [LIVEKIT data packets] ─► analyst console
                                                               │
                                                               ▼
                       [QWEN voice] ─► optional earpiece cue ("Q4 still thin — ask margins")
   Everything on [AWS]; every model call governed + logged via [TRUEFOUNDRY].
```

| Sponsor | Role | Where | Effort | Verdict |
|---|---|---|---|---|
| **LiveKit** | Live audio transport, STT, agent runtime, data packets to the UI | whole live loop | ~0 (starter) | Core. Already wired. ([LiveKit](https://docs.livekit.io/agents/models/)) |
| **Moss** (host) | Semantic search over notes/filings/papers, mid-call | `ground_answer` + follow-up grounding | ~0 (starter) | Core. The retrieval hero. ([Moss · YC](https://www.ycombinator.com/companies/moss)) |
| **Unsiloed** | Parse messy research notes / 10-Ks / papers into RAG chunks for Moss | offline | Low (1 parse) | Genuine. Finance = the richest doc pile. ([Unsiloed](https://www.unsiloed.ai/)) |
| **MiniMax** | The brain: score coverage, extract facts, generate follow-ups, emit tool calls | after STT | Med (swap LLM) | Core reasoning. |
| **TrueFoundry** | Gateway in front of every LLM call: routing, fallback, full audit log | wraps MiniMax | Low if OpenAI-compatible (point `base_url`) | Strong fit. Audit = a real buy-side requirement. |
| **Qwen** | Voice cue into the analyst's earpiece (never the call) | output to analyst | Med-High | The one we fit in. Honest home: the headset cue, since the copilot is silent on the call. |
| **AWS** | Host agent + frontend, store corpus + audit logs | everywhere | Med (deploy) | Infra. Pairs with TrueFoundry for the "runs in your own cloud" story. |

### Priority tiers (don't let sponsor-stuffing tank the demo)

- **Tier 1 — core, mostly free:** LiveKit + Moss (starter) + Unsiloed (one offline parse)
  + MiniMax routed through TrueFoundry. If TrueFoundry is OpenAI-compatible, pointing the
  agent's LLM `base_url` at it gets MiniMax + TrueFoundry in one move — already 5 of 7
  sponsors at low marginal effort.
- **Tier 2 — add if time / for prizes:** Qwen (earpiece cue) and AWS deploy.
- **Hard rule:** the hero (the coverage list ticking green + a follow-up firing on a thin
  answer) must work even if Qwen and AWS aren't wired. Keep them as enhancements.

**Prizes:** 1st = a YC partner interview ([Pete Koomen on X](https://x.com/koomen/status/2060336454946185384));
Unsiloed is putting up iPhones + swag ([Aman / Unsiloed on X](https://x.com/aman_unsiloed/status/2061337831021420879)).

## Hackathon scope (24 hours)

**Must build:**
1. Flip `agent.py` to a silent listener that loads a pre-call question list at session start,
   hooks each researcher turn, scores coverage, fires tools, publishes cards. No TTS to room.
2. The coverage engine: structured per-turn scoring (`unanswered/partial/answered`) +
   gap-closing follow-up generation, anchored to the question list.
3. Corpus: parse one real equity research note + the company's 10-K via **Unsiloed** → Moss
   `knowledge` index (`create_index.py`). Fallback if the API fights you: hand-write the key
   chunks into `knowledge.json`. Plus a hand-written question list (6–8 questions) + thesis memo.
4. Analyst console (frontend): coverage list + follow-up queue + grounding feed + thesis
   delta. Reuse the starter's "Knowledge Matches" panel as the grounding feed.
5. A scripted demo call (recorded audio or a teammate reading the researcher's lines) that
   leaves 1–2 questions `partial` so the follow-up + close moment fires on stage.

**Stretch:**
- **Academic / industry-lab track** — same brain, swap the corpus to papers/primers; the
  deep-tech diligence closer.
- Post-call thesis memo generated from `recall_facts` (the full hypothesis update).
- Qwen earpiece cue; AWS deploy.

**Explicitly NOT in scope (say it out loud in the demo):**
- The copilot speaking on the call or making a trade. Never. It surfaces; the analyst acts.
- Real FactSet/Bloomberg/consensus feeds. Out of scope; mocked as structured inputs.
- Real telephony / dialing the actual researcher. We demo on piped-in audio.
- MNPI/compliance hardening, auth, production deploy. Hackathon, not a deployment. (Note the
  TrueFoundry audit log as the seed of the real compliance story.)

## Demo (what the judges see)

Pre-load a real name: the equity analyst's research note, the company's 10-K, a one-line
thesis, and the fund's 6–8 diligence questions on screen.

1. **Coverage:** the call starts; as the researcher answers, questions tick green one by one.
   The list is live and honest. (Moss + coverage engine.)
2. **The thin answer (hero):** the researcher gives a vague answer on segment unit economics.
   That question stays **amber**, and the copilot surfaces: *"Their note models 12% growth;
   ask for the contribution margin on that segment specifically."* The analyst asks it; it
   ticks green.
3. **Inconsistency:** the researcher says something that contradicts their published model →
   a flag fires with the source line.
4. **Hang up clean:** every question green, and the thesis note has auto-updated with what
   changed. You left no holes.

That arc — go in with your questions, cover every one, catch the dodge, leave with an updated
thesis — is the whole pitch. The copilot did the tracking and retrieval; the analyst ran the
call and got everything.

## Biggest risks

- **A coverage mis-score on stage** (calls a dodge `answered`, or a good answer `partial`)
  reads as the copilot being dumb. Mitigation: the demo call is scripted; the engine is
  low-temperature and explicit; default to `partial` when unsure; show one honest amber to
  build trust.
- **Generic follow-ups.** The whole value is that the follow-up is *sharp and grounded*. If
  it says "can you elaborate," the wow dies. Ground every follow-up in a specific Moss-retrieved
  gap, and script the demo so the hero follow-up is genuinely good.
- **Latency** — scoring + grounding add an LLM call per turn. It runs in the background (no
  one waits on the AI), but keep the prompt small and the Moss index preloaded
  (`on_enter` already does this — [agent.py:103-123](agent-py/src/agent.py#L103-L123)).
- **Audio source for the demo** — a recorded call piped into the room, or a teammate reading
  the researcher's lines. Lock this early; it's the demo's spine.

## Open questions for you

1. Demo name? (A name with a public equity research note + 10-K and a clean thesis where one
   diligence question obviously goes thin.)
2. Equity track only for the demo, or build the academic/lab track as the closer?
3. Name the product now (5 min with `startup-naming`) or after it works?
4. Build here in `conversation-ai`, or your `voice-hackathon` repo?

## The assignment (next concrete step)

Before writing any code: **write the real question list.** Take one company you'd actually
diligence, and write the 6–8 questions you'd need a JPM/Goldman analyst to answer on a call.
That list is the spec — it defines the corpus, the coverage states, and the scripted demo.
Everything downstream is built to drive that list to all-green.
