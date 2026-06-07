# Moss Auxiliary Corpus — Live Grounding Expansion

Created: 2026-06-06 22:41 PDT
Extends: [live-context-analysis-plan.md](live-context-analysis-plan.md) · the live-grounding hero
Subject: AAPL demo (live path is `/console/live`)

---

## Why

On a live call, `_ground()` runs a Moss top-k query on every finalized researcher
turn and surfaces the matching context to the analyst console
([agent.py `_ground`](../agent-py/src/agent.py)). The grounding is only as good as
what's in the `knowledge` index. The rule: **put a document in for every entity or
metric likely to be said on the call** — then it shows up the moment it's mentioned.

Current DB (454 chunks): Apple 10-K FY25 + 10-Q FY26Q2 + earnings releases (Unsiloed),
Apple Q2/Q1 FY26 call transcripts, Microsoft + Alphabet 10-Q MD&A + their calls.
AAPL 263 / GOOGL 107 / MSFT 84.

## Live status (works today)

Verified end to end: `/console/live` → Start call → Deepgram STT → turn detection →
`_ground` (Moss, Apple DB) → `grade_turn` (GPT-5.2) → coverage/grounding packets →
console. The agent dispatches Apple coverage; the engine scores a turn `partial` with a
follow-up grounded in real Q2 FY26 numbers. **Caveat:** no speaker separation — every
utterance is scored/labeled "researcher" (the `complete_when` gate keeps coverage safe).

## What to add — mention → document

| If they mention… | Document | Grounds |
|---|---|---|
| advanced node / SOC / supply constrained | **TSMC** earnings call + capex | q1 (the supply gate) |
| memory cost / DRAM / NAND | **Micron, SK Hynix, Samsung memory** calls | q2 (memory overhang — the hero) |
| a metric + "last quarter / year ago" | **Prior 4–8 Apple earnings calls** | trend / contradiction (live-context hero) |
| any number | **Sell-side consensus + Apple guidance** | "vs the Street / note" contradictions |
| Google payment / default search / antitrust | **DOJ v. Google search-remedy opinion** | q3 Services regulatory tail |
| DMA / App Store / Epic | **EU DMA decision, Epic v. Apple** | App Store fee / regulatory risk |
| Huawei / China share / market | **IDC / Counterpoint** smartphone + China share | China / competition |
| competitor names | **Samsung, Qualcomm, Dell/HP, Nvidia** filings/calls | peer benchmarking |

## The plan

The pipeline already exists — reuse it, no new code:

```
PDFs       ──[Unsiloed ingest.py]──► corpus/parsed ──► knowledge.json ─┐
transcripts ──[chunk to text]─────────────────────────► knowledge.json ─┴─► create_index.py ─► Moss `knowledge`
```

- PDFs (filings, rulings) → `uv run src/ingest.py <pdf> ` (no `--replace`, so it **merges**).
- Transcripts (earnings calls) → fetch clean text → chunk → append to `knowledge.json` with
  `metadata={ticker, doc_type:"earnings_call"}`.
- Tag every doc with `ticker` + `doc_type` so grounding cards can show provenance and we can
  filter later.
- Rebuild once at the end: `pnpm moss:index`.

### Tier 1 — thesis-critical — DONE (2026-06-06)
Added to the Moss `knowledge` index (now 645 docs: AAPL 367 / GOOGL 119 / MSFT 84 / TSM 36 / MU 39):
- **TSMC Q1 2026 + Micron FQ1 2026** earnings calls → supply + memory story (q1, q2). (SK Hynix skipped — no public transcript page.)
- **Prior Apple calls FY25 Q4 / Q3 / Q2** → trend grounding on any metric.
- **DOJ v. Google search-remedy ruling (Sep 2 2025)** → the Services regulatory tail (q3). Sourced from NPR reporting (the full court opinion PDF isn't publicly linked).

Verified: "advanced node / supply" → TSMC/Micron/Apple calls; "memory cost / DRAM" → Micron + Apple 10-Q; "iPhone last year" → prior Apple quarters; "Google payment / antitrust" → the DOJ ruling. All in top-3.

### Tier 2 — competitive + regulatory breadth
- Samsung (smartphones / memory), Qualcomm (modems/SOC), Dell/HP (AI PC) calls or filings.
- EU DMA decision + Epic v. Apple summary.

### Tier 3 — market data + estimates
- IDC / Counterpoint smartphone + China share, Canalys PC shipments.
- Sell-side consensus + Apple guidance (needs FMP key — currently unset).

### Verify
- Re-run the retrieval probe: each tier-1 mention ("advanced node", "memory cost", "Google
  payment", "last quarter iPhone") returns the new doc in top-3.
- `pnpm moss:index` reports the new doc count; spot-check provenance on a live turn.

## Honest constraints
- **Speaker separation** is still the one live gap (Phase 1B in the build plan).
- **FMP key** is unset in this environment, so consensus/estimates (Tier 3) is blocked until
  it's available; everything else comes from SEC EDGAR, company IR, court PDFs, and public
  transcript pages.
