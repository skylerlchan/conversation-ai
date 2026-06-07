# CAVA financial data — Argus demo corpus

All of CAVA Group's (**NYSE: CAVA**) financial data, pulled **2026-06-06** via the WithAI
`fmp-data` ability (Financial Modeling Prep, Ultimate plan). This is the **real-data** corpus
for the Argus diligence-call demo — the factual ground truth behind the synthetic call fixtures
in [`../`](../).

**Start here:** [CAVA-financials-summary.md](CAVA-financials-summary.md) — the human-readable
digest (snapshot, statements, valuation, peer comps, analyst view, data-quality notes).

Source for everything: Financial Modeling Prep. Pull date: 2026-06-06. ~744KB total.

## Layout

```
cava_financials/
  CAVA-financials-summary.md   <- read this first (the digest)
  README.md                    <- this index
  transcripts/                 <- 5 most recent earnings calls, formatted (verbatim)
  raw/                         <- raw FMP JSON, one file per endpoint (source of truth)
```

## transcripts/ — verbatim earnings calls

Formatted via the `fmp-data` transcript formatter (speaker roles, prepared-remarks vs Q&A,
participant roster). FY2023 Q2 → FY2026 Q1 are available from FMP; the 5 most recent are saved:

| File | Call date |
|---|---|
| [CAVA-FY2026-Q1-transcript.md](transcripts/CAVA-FY2026-Q1-transcript.md) | 2026-05-19 |
| [CAVA-FY2025-Q4-transcript.md](transcripts/CAVA-FY2025-Q4-transcript.md) | 2026-02-24 |
| [CAVA-FY2025-Q3-transcript.md](transcripts/CAVA-FY2025-Q3-transcript.md) | 2025-11-04 |
| [CAVA-FY2025-Q2-transcript.md](transcripts/CAVA-FY2025-Q2-transcript.md) | 2025-08-13 |
| [CAVA-FY2025-Q1-transcript.md](transcripts/CAVA-FY2025-Q1-transcript.md) | 2025-05-15 |

(Older quarters are available — see [raw/transcript-dates.json](raw/transcript-dates.json) — and
can be pulled the same way if needed.)

## raw/ — JSON by endpoint

**Company & market**
- `profile.json`, `quote.json` — identity, sector, CEO, IPO; live quote / market cap / 52w range
- `historical-prices-since-ipo.json` — 745 daily closes, 2023-06-16 → 2026-06-05

**Financial statements** (annual = up to 10y; quarterly = last 12q)
- `income-statement-annual.json` / `-quarterly.json`
- `balance-sheet-annual.json` / `-quarterly.json`
- `cash-flow-annual.json` / `-quarterly.json`
- `income-growth-annual.json` / `-quarterly.json` — YoY growth rates

**Metrics, ratios, valuation**
- `key-metrics-annual.json`, `key-metrics-ttm.json`
- `ratios-annual.json`, `ratios-ttm.json`
- `dcf.json`, `dcf-levered.json` — FMP DCF (returns negative fair value; model artifact, see summary)

**Analyst & earnings**
- `analyst-estimates-annual.json` / `-quarterly.json` — forward rev/EPS consensus (out to FY2030)
- `price-target-consensus.json`, `price-target-summary.json` — targets ($89.63 consensus)
- `grades.json` — analyst rating actions (40 most recent)
- `earnings-history.json` — EPS/revenue actual vs estimate (surprise history)

**Ownership & insiders**
- `insider-trades.json` — 40 most recent insider transactions
- `insider-statistics.json` — buy/sell summary

**Peers / comps**
- `peers.json` — FMP auto-peers (generic market-cap match; not restaurant-specific)
- `peers-fastcasual-quotes.json` — curated set: CMG, SG, WING, SHAK, DPZ, TXRH, DRI
- `peer-keymetrics-<TICKER>.json`, `peer-ratios-<TICKER>.json` — per-peer TTM metrics for the comp table

**Filings, segmentation, news**
- `sec-filings.json` — filing index since 2023 (metadata + EDGAR links; FMP doesn't host raw docs)
- `revenue-product-segmentation.json` — restaurant revenue (single segment; geographic seg is empty — US-only)
- `news.json` — 40 most recent stock-specific news items
- `transcript-dates.json` — all available earnings-call dates

## Notes & data-quality flags (detail in the summary)

- **16-week fiscal Q1.** CAVA's Q1 is 16 weeks; Q2–Q4 are 12. Q1 revenue is correspondingly larger — not an error.
- **FMP gross margin is inconsistent YoY** (25.1%→18.4%); use **restaurant-level margin (~25%)** from the calls/10-K instead.
- **FY2024 net income** is inflated by a one-time tax benefit — use operating income for the trend.
- **FMP DCF / auto-peers / SG P/E** are unreliable for this name — flagged in the summary; curated comps provided.
- **No dividend** and **no geographic segmentation** for CAVA, so those endpoints returned empty and were omitted.

## Re-pulling / extending

Everything came from FMP `stable` endpoints with the `fmp-data` ability. To refresh or add an
endpoint, re-run the same curls (key + base URL are in the ability SKILL.md) writing into
`raw/`, and re-format transcripts with the ability's `format_transcript.py`.
