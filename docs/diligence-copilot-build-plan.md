# Diligence-Call Copilot — Build Plan

Created: 2026-06-06 19:18 PDT
Extends: [diligence-call-copilot-plan.md](diligence-call-copilot-plan.md) (product) · [live-context-analysis-plan.md](live-context-analysis-plan.md) (metric-aware grounding)
Goal: take the three systems — **live transcript → coverage tracking → context-to-analyst (Moss)** — from "deterministic core, mocked at every live boundary" to a working end-to-end live call that drives the analyst console.

---

## Build status (2026-06-06)

**Shipped (Phases 0-2 spine + the demo-name convergence):**
- Live data path wired end to end — the console renders off the agent's LiveKit packets, not just the fixture. `lib/live/types.ts` (packet contract), `lib/console-model.ts` (one view-model, two sources), `hooks/useLiveDiligence.ts`, `MissionConsoleView` split, `/console/live` route under the room provider, launcher routes there.
- Backend publishes a per-turn `transcript` packet (the transcript-source decision, implemented as a backend packet rather than LiveKit-native given same-room). Same-room handling: all turns labeled researcher; `complete_when` gating keeps coverage correct. +1 test.
- Fake-live driver (`agent-py/src/fake_live.py`) replays a scripted call into a room as real packets — integration harness + stage fallback. Its `build_packets()` folds the scripted verdicts through the real `apply_verdict` (Phase 2.1 arc-from-machinery check). +4 tests.
- Demo converged on **Chipotle (CMG)** across backend `questions.json`, demo fixtures, and frontend.
- Verified: 49 backend tests pass; `next build` green; frontend typecheck + eslint clean.

**Not yet built (later phases):** real piped-in audio (Phase 3), thesis-delta packet (Phase 4), metric-aware Live Context card (Phase 5.1), launcher→`/api/analyze` real-ticker path (Phase 5.2), sponsors (Phase 6). The CMG Moss corpus is hand-authored pending an Unsiloed parse run.

---

## Where we are (the honest baseline)

The deterministic core is built and unit-tested (44 tests pass offline). What's *not* connected is everything at the live boundary, plus one product-blocking mismatch.

| System | Built & tested | Gap to live |
|---|---|---|
| Live transcript | `on_user_turn_completed` records turns, always `StopResponse` (silent) | **No speaker discrimination** — analyst's own questions get graded as researcher answers ([agent.py:113](../agent-py/src/agent.py#L113)) |
| Coverage tracking | state machine, monotonic `apply_verdict`, schema-constrained `grade_turn` | demo arc not verified through the *real* engine; real-LLM accuracy untested |
| Context-to-analyst (Moss) | offline ingest, `_ground` top-k=3, `grounding` packet | generic retrieval only (not metric-aware); `memory` index loaded but unused |
| **Console (the screen)** | scripted CAVA fixture replay ([mission-console.tsx](../frontend/components/console/mission-console.tsx)) | **does not consume live packets at all** — the live agent updates nothing on screen |

Three cross-cutting problems block everything:

1. **Packet contract mismatch.** Agent emits `coverage_update` + `grounding`; the only live frontend consumer ([useMossContextEvents](../frontend/hooks/useMossContextEvents.ts)) listens for the old `moss_context`. The console replays a fixture instead.
2. **Two demo names.** Backend live path is wired for synthetic **Cirrus Logistics (CRLG)** ([questions.json](../agent-py/questions.json) + corpus); frontend demo replays **CAVA** ([cava-call.json](../frontend/lib/demo/cava-call.json)). They must converge.
3. **Stale [AGENTS.md](../agent-py/AGENTS.md)** describes the deleted `Assistant`/`search_knowledge`/`moss_context` design.

---

## Decisions (locked in eng review, 2026-06-06)

1. **Demo name: Chipotle (CMG).** Rebuild both sides to CMG — backend `questions.json` + corpus (memo + 10-K/10-Q via Unsiloed) and the frontend fixture. CMG also has FMP earnings transcripts, so the Phase 5.2 real-ticker path works on the same name.
2. **Call topology: same room, both speak.** Researcher and analyst are both in the LiveKit room and both talk. The copilot must **separate speakers** (see Phase 1B) — this is the highest-risk item; de-risk with a spike + named fallback.
3. **Transcript source: LiveKit native STT transcription.** The console's transcript comes from LiveKit's transcription stream (the starter's `agent-chat-transcript` path), not from data packets. Coverage from `coverage_update`, grounding from `grounding`. Three clean sources.
4. **Demo transport: build the fake-live driver first** (Phase 1), real audio in Phase 3. The driver is both the integration harness and the stage fallback.
5. **Engine model: stay on `openai/gpt-5.2-chat-latest`**, defer MiniMax/TrueFoundry to Phase 6 — don't destabilize the hero to chase a sponsor.

---

## Phase 0 — Foundation: lock the contract & converge (½ day)

Nothing downstream is safe until the wire format is one source of truth and the two halves agree on a name.

**0.1 — Write the data-packet contract.** The single source of truth for the wire.
- [ ] Create `docs/data-packet-contract.md` documenting every `{type, data}` packet, the `timestamp`-in-epoch-seconds convention ([agent.py:207](../agent-py/src/agent.py#L207)), and `reliable=True` delivery.
- [ ] Pin the two live shapes against code: `coverage_update` = `CallState.snapshot()` (company/ticker/thesis + per-question cards `{id,question,pillar,state,facts,contradictions,followup}` + `counts`); `grounding` = `{query, matches:[{text,score}]}`.
- [ ] Reserve future shapes: `thesis_delta` (Phase 4), `live_context` (Phase 5).
- [ ] Add a `frontend/lib/contract.ts` (or extend `lib/demo/types.ts`) with TS types that exactly mirror the packets, so fixture and live share one type set.
- *Verify:* field-parity check `types.ts` ↔ `coverage.py.snapshot()` (a test asserting the key set, or a documented checklist).

**0.2 — Converge the demo name** (per decision 1).
- [ ] Pick one company; align `agent-py/questions.json`, the corpus chunk(s) in `knowledge.json`, and `frontend/lib/demo/{cava-call,cava-questions}.json` + `agent-py/demo/*` to it (rename files if switching off CAVA).
- [ ] Ensure the chosen company has a memo chunk in the corpus so `_ground` returns a real planted figure.
- *Verify:* `uv run pytest agent-py/tests/test_demo_transcript.py` green; `CallState.from_file(questions.json)` loads without `ValueError`.

**0.3 — Refresh [AGENTS.md](../agent-py/AGENTS.md).**
- [ ] Replace the `Assistant`/`search_knowledge`/`remember_fact`/`recall_facts`/`moss_context`/`test_moss.py` description with the real `DiligenceListener`: silent listener, `on_user_turn_completed` → `_ground`/`grade_turn`/`apply_verdict`, `coverage_update`+`grounding` packets, no function-tools.
- *Verify:* a teammate reading AGENTS.md can find every symbol it names in `src/`.

---

## Phase 1 — Wire the live data path (1 day) — THE critical link

This is the highest-leverage work: it's what makes the live agent actually drive the screen. Two tracks, do in parallel.

### 1A — Frontend: a live console that consumes packets
- [ ] **Extract the view-model reducer.** Today `useDiligenceDemo` derives the view-model from the first N fixture turns ([useDiligenceDemo.ts:122-228](../frontend/hooks/useDiligenceDemo.ts#L122)). Pull the *reduction* (coverage map, activeFollowups, flags, thesisDeltas, transcript, tally) into a pure `reduceDiligence(events)` so both fixture and live share it.
- [ ] **Build `useLiveDiligence(room)`** — subscribe to `RoomEvent.DataReceived`, parse `coverage_update` (replace the whole coverage snapshot) and `grounding` (append a grounding/transcript event), feed through `reduceDiligence`. Returns the same `DiligenceState` shape so the UI is untouched.
- [ ] **Refactor `MissionConsole`** to take a `source: 'fixture' | 'live'` prop (or split into `MissionConsole` presentational + two container hooks). [CoverageBoard](../frontend/components/console/mission-console.tsx#L231), [NextStep](../frontend/components/console/mission-console.tsx#L308), [LiveCall](../frontend/components/console/mission-console.tsx#L390) stay byte-for-byte the same.
- [ ] **Mount the live console under a room provider.** Reuse `AgentSessionProvider` ([app.tsx](../frontend/components/app/app.tsx)); add a `/console/live` route (or a `?live=1` branch) that connects to the room and renders `MissionConsole source="live"`. Launcher routes a real call here.
- [ ] **Retire/realign `useMossContextEvents`** — it parses the dead `moss_context` type. Either repoint it at `grounding` or fold it into `useLiveDiligence`.
- *Verify:* unit test feeds recorded `coverage_update`/`grounding` packets into `reduceDiligence` and asserts the view-model equals the fixture-derived one (producer↔consumer contract — the gap current tests miss).

### 1B — Backend: grade the researcher only
- [ ] **Identify the researcher participant.** Decide the signal: participant identity/metadata set at dispatch (analyst vs researcher), or the SIP/remote participant = researcher. Plumb it into `DiligenceListener` (constructor or room lookup).
- [ ] **Gate scoring in `on_user_turn_completed`** ([agent.py:113](../agent-py/src/agent.py#L113)): only spawn `_score_turn` for researcher turns. Analyst turns still append to `self._turns` (transcript) but don't grade. Keep `StopResponse` unconditional.
- [ ] **(Optional) analyst turn resolves a follow-up** — if an analyst turn matches an active follow-up's question, mark it asked so the card can show "asked, awaiting answer."
- *Verify:* extend `test_agent.py` (TDD per AGENTS.md) — an analyst-side turn does **not** spawn scoring; a researcher-side turn does; transcript still records both.

**Exit criteria for Phase 1:** with the fake-live driver (decision 2) publishing scripted packets into a room, the console ticks coverage green and shows grounded follow-ups **from live packets, not the fixture**.

---

## Phase 2 — De-risk the hero: prove the engine produces the arc (1 day)

The demo's biggest stage risk is a coverage mis-score. Today the scripted arc is asserted against the fixture itself, never through the real engine.

**2.1 — Replay harness (offline, deterministic).**
- [ ] New test that imports `engine` + `coverage`, feeds each scripted researcher turn through the **real** `grade_turn → apply_verdict` (LLM faked with the fixture's `expected` verdicts), and asserts coverage states match `expected.coverage` per turn.
- [ ] Assert the arc emerges from the machinery: a question goes `partial` then `answered` after the follow-up, the contradiction is recorded, the close is all-green. This supersedes `test_demo_transcript.py`'s self-replay.

**2.2 — Real-LLM accuracy eval (gated, runs on demand).**
- [ ] Harness that runs the scripted turns through the real `inference.LLM` (low temp — note: temperature is doc-only today, actually pass it, [engine.py:101](../agent-py/src/engine.py#L101)).
- [ ] Assertions: no dodge scored `answered`, no good answer stuck `partial`, follow-ups not generic (reuse `GENERIC_FOLLOWUP_PHRASES`), contradiction fires on the planted turn.
- [ ] Tune `_RULES` ([engine.py:26-55](../agent-py/src/engine.py#L26)) until clean; mark this eval `@pytest.mark.skipif(no creds)` so CI stays offline.

**2.3 — Moss retrieval smoke test (gated).**
- [ ] One credentialed run: `pnpm moss:index` builds both indexes; `_ground` on a known researcher turn returns the planted memo figure in the top-3.
- [ ] Document the manual run + the 3-index cap / Unsiloed `agentic_ocr` gotchas (already in project memory) in `docs/data-packet-contract.md` or a RUNBOOK.

**Exit criteria:** the hero arc is reproduced by the real engine + real retrieval, not hand-authored JSON.

---

## Phase 3 — Real audio (the true live path) (½–1 day)

- [ ] **Build the fake-live driver first** (decision 2) — a small script/route that publishes the scripted fixture's `coverage_update`/`grounding` packets into a real LiveKit room on a timer. This is both the Phase 1 integration harness and the on-stage fallback if STT misbehaves. (Lives in `agent-py/` as a dev entrypoint or a frontend dev tool.)
- [ ] **Pipe real call audio** (recorded scripted call, or a teammate reading the researcher lines) into the room as a participant; confirm STT → turn detection → `on_user_turn_completed` → researcher-gated scoring → packets → console, end to end.
- [ ] **Confirm the silence invariant holds live** — `audio_output=False` ([agent.py:281](../agent-py/src/agent.py#L281)), no audio track published by the agent.
- [ ] **Lock the demo audio source** — record a clean take; this is the demo's spine.
- *Verify:* manual end-to-end run captured to video; fake-live driver kept as the stage fallback.

---

## Phase 4 — Thesis delta (close the loop) (½ day)

The "the call writes itself into your model" moment. Thesis is input-only today.

- [ ] **Choose the mechanism:** (a) extend `QuestionUpdate`/`TurnVerdict` ([coverage.py:160-177](../agent-py/src/coverage.py#L160)) with a per-turn `thesis_delta` string, or (b) a post-call summarization pass over accumulated `facts`/`contradictions` across all questions. Recommend (b) for a coherent end-of-call memo; (a) for live ticking.
- [ ] **Backend:** compute the delta, publish a `thesis_delta` packet (shape reserved in 0.1: `{summary, changes:[{field,from,to}], net}` — mirrors the fixture's [ThesisDelta](../frontend/lib/demo/types.ts#L83)).
- [ ] **Frontend:** add a thesis-delta card to `MissionConsole` and handle the packet in `reduceDiligence`/`useLiveDiligence`. Fixture type already exists ([types.ts:90](../frontend/lib/demo/types.ts#L90)).
- *Verify:* TDD the new packet shape (`test_agent.py`) + a console render test; replay harness asserts the delta cites real turns.

---

## Phase 5 — Two enhancements (pick by time)

**5.1 — Metric-aware grounding (Live Context card).** Per [live-context-analysis-plan.md](live-context-analysis-plan.md).
- [ ] In `_ground` ([agent.py:159](../agent-py/src/agent.py#L159)): extract the stated metric (name + value) from the turn before querying — small LLM call or regex+LLM.
- [ ] Query the base for the metric's **prior value** (a second targeted Moss query), compute `trend`; add a **peer benchmark** query *only if peer data is loaded* (else `peers: []`, degrade to trend-only).
- [ ] Emit a `live_context` packet (`{metric, stated, prior, trend, peers, read, followup}` — shape reserved in 0.1) and render a Live Context card.
- [ ] Corpus prerequisite: load peer memos/filings or a per-metric peer table for benchmarking (honest constraint — the current memo has no competitor numbers).
- *Verify:* offline test with a planted metric asserts prior+trend; peer path tested only when peer data present.

**5.2 — Launcher → real ticker (the "any name" path).**
- [ ] Make the console read the `?symbol=` param ([launcher routes it](../frontend/components/console/launcher.tsx#L55) but [MissionConsole ignores it](../frontend/components/console/mission-console.tsx#L530)).
- [ ] On a symbol, `POST /api/analyze` ([analyze.ts](../frontend/lib/analyze.ts), already built) → a real earnings-call `Session` → replay it through the same `MissionConsole` (fixture-style source, real data).
- [ ] Handle latency/errors: the analyze call can take ~minutes ([maxDuration 180](../frontend/app/api/analyze/route.ts#L4)) — loading + failure states in the launcher/console.
- *Verify:* manual run on 2-3 tickers (CAVA, NVDA) end to end.

---

## Phase 6 — Sponsor / infra (stretch, only if hero is locked)

- [ ] **TrueFoundry + MiniMax.** Point the engine LLM at TrueFoundry's OpenAI-compatible gateway (`base_url`) running MiniMax — one move lands two sponsors. Isolate behind the existing `inference.LLM` seam ([agent.py:266](../agent-py/src/agent.py#L266)); keep GPT-5.2 as fallback.
- [ ] **Qwen earpiece cue.** Optional TTS of the active follow-up to the *analyst's* headset only — never the room (room stays `audio_output=False`). Separate output participant/track.
- [ ] **`memory` index writeback.** It's loaded but unused ([agent.py:105](../agent-py/src/agent.py#L105)). Store each answer + verdict + extracted facts to the `memory` index tagged `user_id`; enables post-call recall and the thesis memo. Honors the per-user scoping AGENTS.md describes.
- [ ] **AWS deploy.** Containerize (Dockerfile exists) + host frontend; pairs with TrueFoundry for the "runs in your own governed cloud" story.

**Hard rule (from the product plan):** the hero — coverage ticking green live + a grounded follow-up firing on a thin answer — must work even if all of Phase 6 is absent.

---

## Dependency order (critical path)

```
Phase 0 (contract + name) ──► Phase 1 (live data path) ──► Phase 2 (engine proves arc)
                                      │                          │
                                      └──► Phase 3 (real audio) ◄─┘
                                                   │
                                                   ▼
                                   Phase 4 (thesis) · Phase 5 (enhancements) · Phase 6 (sponsors)
```

Phases 0→1→2 are the spine. 3 makes it a real call. 4–6 are layered value, each independently shippable. Everything keeps the silent-listener / context-to-analyst-only invariant.

## Net

The work is mostly **connection, not invention**: lock one wire format (0), make the console consume live packets (1A), grade only the researcher (1B), and prove the arc through the real engine (2). After that the system does what the plan describes — go in with your questions, watch them cover live, catch the dodge, hang up clean — on a live call instead of a replay.
