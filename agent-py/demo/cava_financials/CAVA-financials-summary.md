# CAVA Group (NYSE: CAVA) — Financial Data Summary

Pulled: 2026-06-06 · Source: Financial Modeling Prep (FMP), Ultimate plan · Ticker: **CAVA**

> This is **real** CAVA financial data pulled via the WithAI `fmp-data` ability, for the Argus
> diligence-call demo. It is the factual companion to the synthetic demo fixtures in
> [`../`](../) (`cava_questions.json`, `cava_call.json`). Raw JSON for every figure below lives
> in [`raw/`](raw/); verbatim earnings calls in [`transcripts/`](transcripts/).
> All figures (Source: Financial Modeling Prep) unless noted.

## Snapshot

| Field | Value |
|---|---|
| Company | CAVA Group, Inc. |
| Exchange / sector | NYSE · Consumer Cyclical / Restaurants |
| CEO | Brett Schulman |
| IPO | 2023-06-16 |
| Employees | ~10,300 |
| Price (2026-06-05 close) | **$72.60** |
| Market cap | **~$8.46B** |
| Enterprise value (TTM) | ~$8.66B |
| 52-week range | $43.41 – $98.79 |
| 50d / 200d avg | $83.97 / $68.80 |
| Beta | 1.91 |
| Dividend | None (no dividend history) |

## Income statement — annual (Source: FMP)

| FY (end) | Revenue | YoY | Operating income | Net income | Diluted EPS |
|---|---|---|---|---|---|
| FY2025 (2025-12-28) | **$1.18B** | +21% | $79.3M | $63.7M | $0.54 |
| FY2024 (2024-12-29) | $963.7M | +32% | $43.1M | $130.3M¹ | $1.10¹ |
| FY2023 (2023-12-31) | $728.7M | +29% | $4.7M | $13.3M | $0.21 |
| FY2022 (2022-12-31) | $564.1M | — | -$59.8M | -$59.0M | — |
| FY2021 (2021-12-31) | $500.1M | — | -$52.8M | -$37.4M | — |

¹ **FY2024 net income / EPS are inflated by a one-time income-tax benefit** (deferred-tax
valuation-allowance release). FY2024 net margin is *not* comparable to FY2025's operating
trend — use operating income for the underlying trajectory. (Cross-check in the FY2024 Q4 call.)

## Income statement — recent quarters (Source: FMP)

| Quarter (end) | Weeks | Revenue | Operating income | Net income | Diluted EPS |
|---|---|---|---|---|---|
| FY2026 Q1 (2026-04-19) | 16² | **$438.3M** | $34.7M | $23.6M | $0.20 |
| FY2025 Q4 (2025-12-28) | 12 | $275.0M | $8.4M | $4.9M | $0.04 |
| FY2025 Q3 (2025-10-05) | 12 | $292.2M | $23.2M | $14.7M | $0.12 |
| FY2025 Q2 (2025-07-13) | 12 | $280.6M | $25.8M | $18.4M | $0.16 |
| FY2025 Q1 (2025-04) | 16² | $331.8M | — | — | $0.22 |

² **CAVA's fiscal Q1 is a 16-week period; Q2–Q4 are 12 weeks each.** That's why Q1 revenue
looks far larger than the other quarters — it is not an error. (FY2025 quarters sum to the
$1.18B full year.)

## Margins — read this carefully (data-quality note)

FMP's reported **gross margin swings 25.1% (FY24) → 18.4% (FY25)**, which reflects an
inconsistent cost-of-revenue mapping between years, **not** a real ~7pt margin collapse. For a
restaurant, the operating metric is **restaurant-level profit margin (~25%)**, which CAVA
reports directly on its earnings calls and in the 10-K — use that, sourced from the
[transcripts](transcripts/) / filing, rather than the FMP gross-profit line. TTM operating
margin (~7.2%) and net margin (~4.8%) from FMP are reliable.

## Balance sheet & cash flow (FY2025, Source: FMP)

| Metric | Value |
|---|---|
| Cash & equivalents | $282.9M |
| Short-term investments | $110.1M |
| Total debt (incl. lease liabilities) | $466.2M |
| Total stockholders' equity | $779.7M |
| Total assets | $1.36B |
| Operating cash flow | $184.8M |
| Capex | -$158.7M |
| **Free cash flow** | **$26.1M** |

Capex (new-unit build) absorbs most of operating cash flow — consistent with a
self-funded-growth story, but FCF is thin while the build runs hot (supports demo question Q8).

## Valuation (TTM, Source: FMP)

| Multiple | CAVA |
|---|---|
| P/E (TTM) | ~137x |
| P/S (TTM) | ~6.6x |
| P/B (TTM) | ~10.4x |
| EV/Sales (TTM) | ~6.7x |
| EV/EBITDA (TTM) | ~51x |
| ROE (TTM) | ~7.9% |
| ROIC (TTM) | ~5.4% |
| FCF yield (TTM) | ~0.5% |

> **FMP's generic DCF returns a fair value of -$14.84** ([raw/dcf.json](raw/dcf.json)). That is a
> model artifact — the canned DCF mishandles high-growth names with negligible current FCF. Do
> not use it; it is included only for completeness.

## Fast-casual peer comps (TTM, Source: FMP, pulled 2026-06-06)

CAVA trades at a clear premium to the fast-casual group on sales — the crux of the bull case.
(The FMP auto-peer list in [raw/peers.json](raw/peers.json) is a generic market-cap match; this
is the curated restaurant set. P/E is unreliable where earnings are near zero — e.g. SG — so
read P/S across the row.)

| Ticker | Name | Price | Mkt cap ($B) | P/E (TTM) | P/S (TTM) |
|---|---|---|---|---|---|
| **CAVA** | CAVA Group | $72.60 | 8.5 | 137.1 | **6.6** |
| CMG | Chipotle | $29.34 | 37.6 | 26.2 | 3.1 |
| SG | Sweetgreen | $7.42 | 0.9 | n/m | 1.3 |
| WING | Wingstop | $142.23 | 3.9 | 34.9 | 5.5 |
| SHAK | Shake Shack | $52.34 | 2.1 | 51.2 | 1.4 |
| DPZ | Domino's | $313.99 | 10.4 | 17.9 | 2.1 |
| TXRH | Texas Roadhouse | $170.46 | 11.2 | 27.1 | 1.8 |
| DRI | Darden | $198.12 | 22.7 | 20.8 | 1.8 |

## Analyst view (Source: FMP)

- **Price targets:** consensus **$89.63**, median $92, high $106, low $64 (vs $72.60 spot).
  75 targets all-time; 12 in the last month averaging $92.75.
- **Recent ratings (May–Jun 2026):** mostly Buy/Outperform — TD Cowen (Buy), RBC (Outperform),
  Stifel (Buy), Roth (Buy), Telsey (Outperform); Argus upgraded Hold→Buy (2026-05-22);
  DA Davidson at Neutral. Full history: [raw/grades.json](raw/grades.json).
- **Forward estimates (annual avg):** FY2027E rev ~$1.81B / EPS ~$0.75 (19 analysts);
  FY2028E ~$2.18B / ~$1.06; FY2029E ~$2.52B / ~$1.38; FY2030E ~$2.97B / ~$1.80.

## Earnings surprise history (Source: FMP)

| Report date | EPS actual | EPS est | Revenue actual | Revenue est |
|---|---|---|---|---|
| 2026-05-19 | $0.20 | $0.17 | $438.3M | $360.5M |
| 2026-02-24 | $0.04 | $0.03 | $275.0M | $268.4M |
| 2025-11-04 | $0.12 | $0.13 | $292.2M | $267.9M |
| 2025-08-12 | $0.16 | $0.13 | $280.6M | $293.9M |
| 2025-05-15 | $0.22 | $0.14 | $331.8M | $287.7M |

Mostly revenue beats; EPS mixed. (Source: Financial Modeling Prep)

## How this maps to the Argus demo

The synthetic fixtures (`../cava_questions.json`) model assumptions the copilot grounds against
($2.6M new-unit AUV, ~25% restaurant-level margin, ~1,000-unit target, traffic-led comp). Those
are now cross-checkable against this **real** data and the **real transcripts** in
[`transcripts/`](transcripts/) — so the grounding corpus can be upgraded from hand-written
chunks to actual CAVA disclosures (the Unsiloed-parse step in the plan). The 16-week-Q1 and
gross-margin quirks above are exactly the kind of inconsistency Argus is built to catch.
