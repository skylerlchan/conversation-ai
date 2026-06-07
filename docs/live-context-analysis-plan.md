# Live Context & Comparative Analysis — Plan

Created: 2026-06-06 18:59 PDT
Extends: [diligence-call-copilot-plan.md](diligence-call-copilot-plan.md) · builds on the live coverage engine
Status: idea captured; not yet built

---

## The idea

When the researcher states a **metric** on the call, the copilot doesn't just retrieve a
matching snippet — it **analyzes the number in real time** and hands the analyst context they'd
otherwise have to remember or look up:

1. **Prior value / trend** — what was this same metric last quarter / last year, and which way is
   it moving.
2. **Competitive benchmark** — what the same metric looks like for peers, *if that data is in the
   knowledge base*.
3. **Recommended follow-up** — the sharp next question, grounded in the trend or peer delta.

> Example: the researcher says *"foot traffic increased X%."* The copilot surfaces: *last quarter it
> was +Y% (decelerating), peer Z reported +W%* — and recommends: *"ask whether the gain is doors or
> same-store."*

This is the live-grounding hero from the main plan, sharpened from "show the source fact" into
**"benchmark the stated number against history and peers, and tell the analyst what it means."**

## Worked example (grounded in the DECK corpus)

The corpus already holds the figures for the historical half. Using Deckers
([DECK-memo.md](../agent-py/corpus/raw/DECK-memo.md), sourced to the 10-K/10-Q):

| Researcher says | Copilot surfaces (live) | Recommended follow-up |
|---|---|---|
| "Gross margin held up around 60%." | **Stated 59.8% vs 60.3% prior-year quarter → −50 bps YoY.** Note flags "promotional activity slightly increased." | "That's a *decline* in your strongest quarter — how much of HOKA's growth was promotion / new doors vs. same-door full-price?" |
| "Growth is still strong." | **Q3 +7.1% vs +9.8% nine-month → decelerating.** | "What's the unit-vs-price split behind the near-zero (+0.2%) domestic growth?" |
| "HOKA is taking share." | **Peer benchmark** (On, Nike running) — *only if peer metrics are loaded* | "How does HOKA's full-price sell-through compare to On's reported wholesale growth?" |

The first two rows work against today's corpus. The third needs peer data in the base (see below).

## How it maps to what's built

This is an **enhancement of the grounding step**, not a new subsystem. The pieces already exist:

| Capability | Today | Change for this idea |
|---|---|---|
| Per-turn retrieval | `_ground()` does a generic Moss top-k and publishes a `grounding` card ([agent.py:159](../agent-py/src/agent.py#L159)) | Make it **metric-aware**: extract the stated metric, then query the base for (a) its prior value and (b) peer values |
| Fact + comparison | coverage engine returns `extracted_facts` + a `contradiction` string ([engine.py](../agent-py/src/engine.py)) | Generalize `contradiction` into a **comparison**: trend (vs prior) + benchmark (vs peer) + a one-line read |
| Follow-up | engine emits a gap-closing `followup` | Reuse as-is — now it can also be grounded in the trend/peer delta, not only `complete_when` |
| Push to UI | `publish_coverage` / `grounding` packets ([agent.py:217](../agent-py/src/agent.py#L217)) | Add a **Live Context card** packet (below) |

So the coverage engine, Moss, and the publish path are all reused. The net-new work is metric-aware
retrieval + a richer per-metric output shape.

## Proposed output shape (the Live Context card)

```
{
  metric:   "consolidated gross margin",
  stated:   "59.8%",
  prior:    "60.3% (Q3 FY2025)",
  trend:    "-50 bps YoY",
  peers:    [ { name: "...", value: "..." } ],   // [] when not in base
  read:     "declined in the seasonally strongest quarter; note flags higher promotion",
  followup: "ask how much of HOKA growth was promotion / new doors vs. same-door sell-through"
}
```

## Corpus requirement (the honest constraint)

- **Historical context works today.** The notes/10-K/10-Q carry prior-period values, YoY deltas, and
  segment/channel splits — Moss retrieval already reaches them.
- **Competitive benchmarking needs peer data in the base.** The DECK memo references
  "branded-discretionary peers" but contains **no specific competitor numbers**. To surface "peer Z
  reported W%," the knowledge base must include peer metrics — either peer memos/filings or a small
  per-metric peer table. Until then, the `peers` field stays empty and the card degrades to
  trend-only (still useful).

## Scope

**In:** metric-aware grounding (prior + trend), peer benchmark *when peer data is present*, follow-up
grounded in the delta, the Live Context card.

**Out (for now):** computing metrics the corpus doesn't state (no live modeling); peer benchmarking
without peer data loaded; any change to the silent-listener / no-speak design.

## Open questions

1. Peer data: load a few peer memos/filings into the base, or a compact per-metric peer table?
2. One card or two — fold trend + benchmark into the existing grounding card, or a separate Live
   Context card next to coverage / follow-up?
3. Which demo name leads — DECK (consumer, foot-traffic/margins story) fits this idea best of the three.
