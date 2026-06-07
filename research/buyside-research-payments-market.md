# How the Buy-Side Pays for Equity Research & Analyst Access — and How to Break In

*Created 2026-06-06*

How hedge funds and asset managers pay to access sell-side and independent analysts, the real dollar numbers behind each channel, and the playbook for a new (e.g. AI-driven) entrant. Figures are cited inline; see the caveats at the end on source quality and dating.

---

## TL;DR — the numbers that matter

- **Funds rarely write a check for "research."** In the US they pay by routing *trading commissions* to brokers, protected by the **Section 28(e) safe harbor**. The slice of commission spent on research is "**soft dollars**."
- **~75% of buy-side research commission dollars buy *access* — management meetings, analyst calls, conferences — not written reports.** Hedge funds spend ~75% on access / 25% on written research ([Integrity Research](https://www.integrity-research.com/the-incredible-shrinking-equity-commission-pie/)). *This is the single most important fact for an analyst-access product.*
- **Expert networks**: clients pay **~$1,000–$2,500 per hour-long call**; experts themselves get **$200–$1,000+/hr** (≈30–40% of the client fee); annual subscriptions run **$60k to several hundred thousand** ([28 Experts](https://www.28experts.com/blog/how-much-are-you-really-paying-for-with-glg-alphasights-and-guidepoint), [Silverlight](https://www.silverlightresearch.com/blog/how-much-do-expert-networks-charge)).
- **Research/data platforms**: AlphaSense runs **$10k–$20k per seat/yr**, average deal **$50k–$100k+**, enterprise **$1M+** ([Vendr](https://www.vendr.com/marketplace/alphasense), [Sacra](https://sacra.com/c/alphasense/)).
- **Sell-side written research** (post-MiFID price list): Goldman **$30k/yr** basic (10 users), JPMorgan **$10k**, BofA up to **$80k/user** premium, Barclays **$455k** "gold" ([Bloomberg](https://www.bloomberg.com/news/articles/2017-10-17/goldman-sachs-is-said-to-ask-30-000-for-research-under-mifid-ii), [Integrity Research](https://www.integrity-research.com/research-fees-update-1-jp-morgan-offers-free-research-retail-clients/)).
- **Spend is brutally concentrated**: top 10 providers take **55%** of an average research budget, top 3 take **24%** ([Substantive Research](https://substantiveresearch.com/insights-and-press/new-survey-shows-us-investment-research-budgets-recover-post-mifid-ii-but-european-research-spend-languishes/)). Brokers get **85%** of total research spend, independents **8%**, expert networks **2%**, tools/analytics **5%** ([Integrity Research](https://www.integrity-research.com/u-s-investment-research-budgets-rebound-15-in-2024/)).
- **Tailwind for new entrants**: US research budgets are *recovering* (+40bps of AUM since 2022 vs +2bps in Europe), independent-provider spend is up **~29% since 2022**, and the 2024–2026 MiFID II re-bundling reversal is freeing CSA budgets that flow "toward differentiated coverage" rather than the incumbent top 3.

---

## 1. The core mechanism: soft dollars, Section 28(e), and CSAs

### Soft dollars and the safe harbor
In the US, a manager pays for sell-side research by directing client trades to a broker and paying a commission **higher than the cheapest available execution**, with the excess implicitly buying research. **Section 28(e)** of the Securities Exchange Act of 1934 (enacted 1975) creates a *safe harbor*: the manager is not in breach of best-execution fiduciary duty for not picking the lowest rate, as long as it determines in good faith the commission is reasonable relative to the brokerage + research value received ([Cornell LII](https://www.law.cornell.edu/uscode/text/15/78bb), [The Hedge Fund Journal](https://thehedgefundjournal.com/sec-confirmation-on-soft-dollars-safe-harbour/)).

The "**soft dollars**" are specifically the portion of the client's commission used to buy eligible research/brokerage. To qualify, a product must pass a **three-step test**: (1) it's eligible research or brokerage, (2) it provides lawful and appropriate assistance to investment decisions, (3) commissions are reasonable relative to value ([SEC 2006 Interpretive Release; OCC Bulletin 2007-7]). The SEC's then-Commissioner Uyeda confirmed (July 2023) that US managers "typically pay for sell-side research through bundled client payments for brokerage commissions and research, i.e., soft dollar arrangements" ([SEC](https://www.sec.gov/newsroom/speeches-statements/uyeda-statement-staff-no-action-letter-07-05-2023)).

> **Why this matters for a new entrant:** if your product qualifies as "eligible research," funds can pay you out of *client commissions (soft dollars / CSA credits)* rather than the firm's own P&L. That is a far easier budget to tap than asking a fund to expense a new SaaS line item.

### Commission-Sharing Arrangements (CSAs) — the dominant vehicle
A CSA lets a fund concentrate execution with a few brokers while accumulating a research "credit pool" it can later direct to *any* research provider (including independents who don't execute trades). CSAs are now the dominant soft-dollar mechanism:

- **>40% of total buy-side equity commissions** flow through CSAs; **~4 of 5 buy-side firms** use them; **>50%** of CSA volume is executed electronically ([S&P Global / Coalition Greenwich](https://www.spglobal.com/market-intelligence/en/news-insights/research/shining-a-spotlight-on-the-client-commission-costs-of-csa-soft-dollar-aggregation-platforms)).
- CSA aggregator platforms charge a **"toll" of 4–10 mils/share** ($0.0004–$0.0010/share, i.e. up to 1/10th of a cent) and **~1/4 basis point** on international trades. Some cap fees around **$75k/yr per broker**.
- **Worked example** (from the same source): a fund trading **10M CSA shares/month per broker at a 7-mil toll** pays the aggregator **$7,000/month = $84,000/year per broker**, or roughly **$1,260,000/year across 15 CSA brokers** — purely for the administrative plumbing, before any research is bought.

---

## 2. The "broker vote" — how dollars get allocated

The **broker vote** is the budgeting ritual that decides which providers get paid and how much ([Integrity Research](https://www.integrity-research.com/de-mystifying-the-broker-vote/), [Coalition Greenwich](https://www.greenwich.com/equities/broker-vote-mechanics-valuing-sell-side-research-and-compensating-brokers)):

- **Cycle:** quarterly (most common), semi-annual, or annual.
- **Voters:** each investment professional gets a set number of votes; a senior PM gets a larger allotment than a junior analyst; trading staff sometimes vote too.
- **Tabulation:** votes are summed, each vote is assigned a commission-dollar value, and commissions are paid to providers in proportion to votes received.
- **Settlement:** via trading-desk commissions, soft-dollar allocations through CSAs or step-outs, and occasionally hard dollars.

**Implication for breaking in:** you don't sell to a procurement gatekeeper alone — you have to earn votes from individual PMs and analysts who find your research useful enough to spend their personal vote allocation on you. Land-and-expand happens one analyst at a time.

---

## 3. Regulation: MiFID II unbundling vs. the US — and the 2024–2026 reversal

| | EU / UK (MiFID II, Jan 3 2018) | US |
|---|---|---|
| Original rule | **Unbundle** research from execution; pay from own P&L or a client research payment account (RPA) | Never adopted unbundling; bundled soft dollars retained under 28(e) |
| Key date | — | SEC no-action relief enabling separate hard-dollar payments **expired July 3, 2023** and was not renewed |

([SEC / Commissioner Uyeda](https://www.sec.gov/newsroom/speeches-statements/uyeda-statement-staff-no-action-letter-07-05-2023))

**The reversal now underway:**
- **UK** — FCA **PS24/9** permits "**joint payments**" (re-bundling research with execution) effective **Aug 1, 2024**, citing UK competitiveness and the difficulty of receiving US research after the SEC relief lapsed ([Morgan Lewis](https://www.morganlewis.com/pubs/2024/08/uk-fca-adopts-joint-payment-option-allowing-bundling-of-payments-for-research-and-trade-execution)).
- **EU** — Directive **(EU) 2024/2811** lets firms choose to pay for execution and research separately *or* jointly, and removes the prior €1bn market-cap threshold; rules apply from **June 6, 2026** ([EUR-Lex](https://eur-lex.europa.eu/eli/dir/2024/2811/oj/eng), [Generation Impact](https://generationimpact.global/news/mifid-ii-research-unbundling-reform/)).

**Buy-side sentiment has flipped hard toward client-funded (CSA) research** ([Substantive Research survey, July 2025](https://substantiveresearch.com/insights-and-press/buy-side-survey-reveals-mifid-ii-reversal-as-europe-moves-back-to-csas/)):
- **52%** now expect the majority of research budgets to move to client-funded status (up from **7%** previously); **87%** predict at least half of budgets will be client-funded within two years.
- Support for joint payments jumped to **71%** (from 16% in January); **97%** now call the rules "workable" (vs 40%).

### The post-MiFID sell-side research price list
When MiFID II forced explicit pricing in 2018, the sticker prices became public ([Bloomberg](https://www.bloomberg.com/news/articles/2017-10-17/goldman-sachs-is-said-to-ask-30-000-for-research-under-mifid-ii), [Integrity Research](https://www.integrity-research.com/research-fees-update-1-jp-morgan-offers-free-research-retail-clients/)):

| Bank | Price | Scope |
|---|---|---|
| JPMorgan | **$10,000/yr** | Basic equity research (deliberately low — "predatory pricing" accusations followed) |
| Goldman Sachs | **$30,000/yr** | Basic research portal, up to 10 staff (analyst calls cost extra) |
| UBS | **~$40,000/yr** | Basic research |
| BofA | up to **$80,000/user** | Premium |
| Nomura | **$134,000** | Premium |
| Crédit Agricole | from **$137,000** | Priciest analyst package |
| Barclays | **$455,000** | "Gold" equity research |

Note the spread: **the written report is nearly free; the premium is access to the analyst.**

---

## 4. Expert networks — GLG, AlphaSights, Guidepoint, Third Bridge, Tegus

Expert networks sell *primary access* — phone calls with industry operators, ex-employees, channel participants.

- **Per call:** typically **$1,000–$2,500 per hour-long consultation** ([28 Experts](https://www.28experts.com/blog/how-much-are-you-really-paying-for-with-glg-alphasights-and-guidepoint)).
- **Expert pay:** **$200–$1,000+/hr**, usually only **30–40%** of what the client pays.
- **Network margin:** the rest funds compliance, sourcing, scheduling — networks run at **30–45% margins**. (Example: client pays $1,500, expert gets $500, network keeps $1,000.)
- **Annual subscriptions:** **$60,000 to several hundred thousand** for enterprise clients.
- **Relative pricing:** GLG is premium (~10–15% above peers); AlphaSights ~5–10% below GLG; Guidepoint ~10–20% below GLG (most cost-competitive) ([Silverlight Research](https://www.silverlightresearch.com/blog/how-much-do-expert-networks-charge)).

**Tegus / AlphaSense:** AlphaSense acquired Tegus for **$930M (July 2024)**; Tegus's expert-call transcript library is now bundled into AlphaSense rather than sold standalone ([Sacra](https://sacra.com/c/alphasense/)).

---

## 5. Research & data platforms (the "tools" budget)

- **AlphaSense:** **$10,000–$20,000 per seat/year**; average deal **$50k–$100k+**; large enterprises **$1M+**; pricing varies 30–50% by negotiation ([Vendr](https://www.vendr.com/marketplace/alphasense)). Company scale: **$600M ARR** (March 2026), **$7.5B** valuation (June 2026), **7,000+** enterprise customers, revenue/customer up from **$28k → $66k** in <3 years ([Sacra](https://sacra.com/c/alphasense/)). AlphaSense sizes the financial/market-intelligence tools market at **~$13B annually**.
- **Terminals/data (reference points):** Refinitiv Eikon ~**$22,000/yr** (stripped-down ~$3,600); Bloomberg Terminal ~$30k/yr ([WSP / search results](https://www.interactivebrokers.com/en/pricing/research-news-services.php)).
- **AI-native research startups** (Rogo, Brightwave, Hudson Labs, BlueFlame) sell **enterprise, custom-quoted** deals to CIOs / research directors / procurement — public per-seat pricing is not disclosed, but they position above analyst-tool SaaS and target the same institutional budgets ([Terminal-X comparison](https://www.terminal-x.ai/blog/top-10-ai-tools-for-finance--investors), [OpenAI/Rogo](https://openai.com/index/rogo/)).

---

## 6. Total spend, allocation, and concentration

### The pool
Hard current absolute totals are hard to verify publicly; the best-documented structural breakdown (US, 12 months ended Q1 2012 — **dated but structurally durable**) is ([Integrity Research](https://www.integrity-research.com/the-incredible-shrinking-equity-commission-pie/)):
- US equity commission pool: **$10.86B** (Q1 2012, in secular decline); the research portion was **~$6.2B**.
- **~75% of buy-side research commission dollars go to *access* — management/analyst meetings, conferences, sales** — not written research. Hedge funds: **75% access / 25% written**; long-only: **69% / 31%**.

### Allocation by provider type (2024)
([Integrity Research / Substantive data](https://www.integrity-research.com/u-s-investment-research-budgets-rebound-15-in-2024/))
- **Brokers: 85%** · Independent research providers: **8%** · Expert networks: **2%** · Tools & analytics: **5%**

### Concentration (the barrier)
([Substantive Research, April 2026](https://substantiveresearch.com/insights-and-press/new-survey-shows-us-investment-research-budgets-recover-post-mifid-ii-but-european-research-spend-languishes/))
- **Top 10 providers = 55%** of an average research budget; **top 3 = 24%**; top 10 brokers alone = **54.9%**.

### Direction of travel (the opening)
- US research budgets recovered **+40 bps of AUM since 2022** vs **+2 bps** in Europe; global budgets **+~1% in 2025**, growth driven entirely by US firms.
- For managers **>$150bn AUM**, average US research budgets are now **$8.6M/yr higher** than UK/EU equivalents; in extreme cases **5x higher**.
- **Independent research providers ≈ 9% of budgets but spend grew ~29% since 2022**, and newly unlocked UK CSA budgets are "more likely to flow toward differentiated coverage than toward the top-three providers."

---

## 7. How a new (AI-driven) entrant breaks in

**The strategic read:** the money is in *access and differentiated insight*, not written reports (75% access split), the incumbent top-10 are entrenched (55% of budgets), but the budget is growing in the US and tilting toward independents (+29%). So a new entrant wins by being a *differentiated, vote-worthy* provider that plugs into existing payment rails.

**1. Decide which budget you're tapping.** Three doors, easiest-to-hardest to access:
- **Tools/analytics budget (5%)** — straight SaaS, per-seat ($10–20k/seat like AlphaSense), paid hard dollars. Fastest to sell, but smallest pool and you compete with AlphaSense/Bloomberg.
- **CSA / soft-dollar research budget (the big one)** — get classified as "eligible research" under Section 28(e). Funds then pay you from *client commissions*, not P&L. This is the prize: it's a larger, recovering, less price-sensitive budget.
- **Expert-network / access budget** — if your product brokers or synthesizes primary access, you compete on the $1,000–$2,500/call economics.

**2. Get soft-dollar (28(e)) eligible.** Pure research content is generally eligible. But anything that looks like *technology, data, or order management* is "mixed-use" and must be split — the research-eligible portion paid soft, the rest hard dollar. Architect the offering and the contract so the analytical/insight layer is cleanly research-eligible; this is a legal/packaging exercise, not just a product one ([hedge fund soft-dollar practices](https://hedgefundlawblog.com/hedge-fund-soft-dollars-permitted-soft-dollar-practices.html)).

**3. Win the broker vote one analyst at a time.** There is no single buyer. You need individual PMs/analysts to spend their personal vote allotment on you each quarter. Land-and-expand: get a few analysts hooked, show up in the vote, grow the dollar allocation.

**4. Pricing models that funds accept:**
- Per-seat **$10k–$20k/seat/yr** (analyst-tool tier).
- Enterprise / platform **$50k–$100k+**, scaling to **$1M+** for large multi-strategy funds.
- Usage/access (per-call or per-report) where you mirror expert-network economics.
- For CSA-funded deals, the "price" is a target annual commission allocation negotiated into the broker vote.

**5. Realistic barriers:**
- **Concentration** — top 10 take 55%; you're fighting for the long tail and the growing independent slice.
- **Compliance/vetting** — funds (and MNPI rules) demand serious info-barrier and compliance infrastructure, especially for anything touching primary access. This is much of what expert networks' 30–45% margin actually pays for.
- **Trust & track record** — research is bought on perceived edge; cold-start credibility is the hardest gate.
- **Incumbent bundling** — AlphaSense/Bloomberg/banks bundle; a point solution must be clearly 10x on one job.

**6. The tailwinds to ride:** US budget recovery (+40bps AUM), independent-provider growth (+29%), and the 2024–2026 re-bundling reversal unlocking CSA budgets that explicitly favor *differentiated* coverage over the top 3. The timing for a differentiated, soft-dollar-eligible, US-focused research product is unusually favorable.

---

## Caveats & source quality

- **Payment mechanics & regulation** (sections 1–3) are settled law / well-corroborated; verified 3-0 in adversarial checking.
- **Budget recovery, sentiment, concentration** figures rest largely on **Substantive Research vendor surveys** (n≈40–50, self-reported, ~$13–20T AUM sampled) — directionally reliable and echoed by neutral trade press (IPE, The TRADE, Markets Media), but not audited.
- **Expert-network and platform pricing** comes from industry blogs and Vendr transaction data, not official rate cards — treat as accurate ranges, not quotes.
- **Absolute commission-pool dollars** ($10.86B / $6.2B) are **2012 US data** — included for the durable *structure* (the 75% access split), not as a current total. The current pool is smaller; a precise current global figure was not publicly verifiable.
- The **CSA toll** source contains a unit-notation slip ("cents" should read "dollars"); the "1/10th of a cent" anchor pins the magnitude correctly.
- Regulatory picture is **live as of June 2026** (EU Directive 2024/2811 applies from June 6, 2026 — effectively now).

### Key sources
- [SEC — Commissioner Uyeda statement on soft dollars & MiFID II relief expiry (July 2023)](https://www.sec.gov/newsroom/speeches-statements/uyeda-statement-staff-no-action-letter-07-05-2023)
- [S&P Global / Coalition Greenwich — CSA aggregation toll costs](https://www.spglobal.com/market-intelligence/en/news-insights/research/shining-a-spotlight-on-the-client-commission-costs-of-csa-soft-dollar-aggregation-platforms)
- [Integrity Research — De-Mystifying the Broker Vote](https://www.integrity-research.com/de-mystifying-the-broker-vote/)
- [Integrity Research — The Incredible Shrinking Equity Commission Pie (access split)](https://www.integrity-research.com/the-incredible-shrinking-equity-commission-pie/)
- [Integrity Research — US research budgets rebound 15% in 2024 (provider-type allocation)](https://www.integrity-research.com/u-s-investment-research-budgets-rebound-15-in-2024/)
- [Substantive Research — US budgets recover post-MiFID, concentration data (April 2026)](https://substantiveresearch.com/insights-and-press/new-survey-shows-us-investment-research-budgets-recover-post-mifid-ii-but-european-research-spend-languishes/)
- [Substantive Research — MiFID II reversal / move back to CSAs (July 2025)](https://substantiveresearch.com/insights-and-press/buy-side-survey-reveals-mifid-ii-reversal-as-europe-moves-back-to-csas/)
- [Morgan Lewis — UK FCA joint-payment option (PS24/9)](https://www.morganlewis.com/pubs/2024/08/uk-fca-adopts-joint-payment-option-allowing-bundling-of-payments-for-research-and-trade-execution)
- [EUR-Lex — Directive (EU) 2024/2811](https://eur-lex.europa.eu/eli/dir/2024/2811/oj/eng)
- [Bloomberg — Goldman $30k research under MiFID II](https://www.bloomberg.com/news/articles/2017-10-17/goldman-sachs-is-said-to-ask-30-000-for-research-under-mifid-ii)
- [28 Experts — GLG vs AlphaSights vs Guidepoint pricing](https://www.28experts.com/blog/how-much-are-you-really-paying-for-with-glg-alphasights-and-guidepoint)
- [Silverlight Research — how expert networks charge](https://www.silverlightresearch.com/blog/how-much-do-expert-networks-charge)
- [Vendr — AlphaSense pricing](https://www.vendr.com/marketplace/alphasense) · [Sacra — AlphaSense metrics](https://sacra.com/c/alphasense/)
