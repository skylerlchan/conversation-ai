# CAVA Diligence Call — Scripted Demo Transcript

Created: 2026-06-06 16:44 PDT

> **SYNTHETIC DEMO FIXTURE** — not investment advice, not real CAVA disclosures.
> Numbers are illustrative; the "Meridian Securities" note is fictional. This is the
> stage script for the Diligence-Call Copilot demo. Machine-readable version with the
> golden coverage verdicts: [cava_call.json](cava_call.json).

**The setup.** A buy-side hedge fund analyst (the customer) is on a diligence call with a
sell-side equity research analyst who covers CAVA. The fund loaded 8 questions before the
call ([cava_questions.json](cava_questions.json)). The copilot listens on the analyst's
side, never speaks, and drives every question to green.

**The arc.** Six questions tick green cleanly. **Q2 (new-unit economics)** goes amber on a
vague answer — the copilot fires a grounded follow-up that closes it. **Q4 (traffic vs
price)** answers green but contradicts the note's traffic-led model — an inconsistency flag
fires. **Q7 (catering)** sits grey until the copilot nudges with time running out. Hang up
all-green with an auto-updated thesis.

Legend for the margin notes: 🟢 answered · 🟡 partial · ⚪ unanswered · ⚑ inconsistency · ✎ thesis delta

---

**Analyst — Q1 (unit growth):** Thanks for making time. Let's start with the build. Your
note has CAVA at about seventeen percent unit growth next year. How derisked is that, and
how much of the pipeline is actually signed?

**Researcher:** The FY26 class is effectively derisked. North of ninety percent of next
year's openings are signed leases, and they've got line of sight roughly two years out as
they push into inland markets. Pipeline depth isn't the constraint here, it's their own
build-and-operate cadence.

> ⚪→🟢 **Q1 answered.** Grounding surfaced: *"~17% FY26E unit growth, fully covered by the
> signed-lease pipeline"* (your note).

---

**Analyst — Q3 (margin durability):** Good. On margins, can the twenty-five percent
restaurant-level margin hold with wage inflation, the steak rollout, and new-unit drag?

**Researcher:** I think so. Steak is accretive to check even if the food cost is a touch
higher, pricing has more than covered wage inflation, and the only real drag is the new-unit
mix, which is already in the model. Fleet margin holds around twenty-four to twenty-five.

> ⚪→🟢 **Q3 answered.** Grounding: *"restaurant-level profit margin ~25%"* (10-K).

---

**Analyst — Q2 (new-unit economics) — first ask:** Let's go deeper on the new units
themselves. Are the recent vintages opening at the AUV you model, and how are the 2023 and
2024 classes maturing?

**Researcher:** Yeah, the new classes are opening strong, we're really encouraged. Returns
are healthy, low-teens cash-on-cash early on, and the team feels great about the cohort. It's
honestly one of the best new-unit stories in the whole group.

> ⚪→🟡 **Q2 PARTIAL — the hero moment.** He dodged the number.
> **Copilot follow-up card fires:** *"Your note models a $2.6M new-unit AUV and ~20%
> year-one restaurant-level margin. Ask specifically: what AUV is the 2024 class actually
> opening at, and what's its year-one restaurant-level margin?"* (grounded in your note's
> new-unit-economics section).

---

**Analyst — the grounded follow-up (copilot-prompted):** Let me pin that down. Your note
models a two-point-six million new-unit AUV and about twenty percent year-one restaurant
margin. Is the 2024 class actually opening at two-point-six, and what's the year-one
restaurant-level margin on that specific cohort?

**Researcher:** Fair. The 2024 class is opening a touch below the mature fleet, call it
around two-point-four million AUV, not two-point-six, and year-one restaurant-level margin is
running high-teens, roughly eighteen percent, ramping to the low-twenties by year two. So a
hair light versus the model, but the ramp shape is intact.

> 🟡→🟢 **Q2 answered.** ✎ **Thesis delta:** new-unit AUV ~$2.4M vs $2.6M modeled (~8%
> light); year-one margin ~18% vs ~20%. Ramp shape intact. *(A below-model number is new
> info, not a self-contradiction — you asked for the actual; he gave it.)*

---

**Analyst — Q4 (traffic vs price):** That's the kind of honesty I want. On the comp, what's
the traffic versus price split right now? Is traffic still positive?

**Researcher:** Honestly, most of this year's comp has been price. They took double-digit
menu price over the last few quarters, and traffic's been roughly flat, slightly positive in
the best quarters, but the heavy lifting is price.

> ⚪→🟢 **Q4 answered — but ⚑ INCONSISTENCY flag fires.** *"Your note models traffic-led
> comp (~5% traffic / ~3% price). He just said comp is price-led: double-digit price, flat
> traffic. Comp quality is materially weaker than the published model — this hits the
> premium-multiple argument directly."* ✎ **Thesis delta:** comp quality downgraded.

---

**Analyst — Q5 (loyalty & digital):** Okay, that changes how I read the comp. On frequency,
where's the loyalty relaunch, and what's the digital mix doing?

**Researcher:** Loyalty relaunch is live, it's points-based now, more flexible than the old
threshold model, and the early frequency data is encouraging. Digital's holding around a
third of sales, roughly thirty-five percent, which is a healthy margin mix.

> ⚪→🟢 **Q5 answered.** Grounding: *"digital ~35%; loyalty relaunched, points-based"* (10-K).

---

**Analyst — Q6 (moat & pricing power):** And the moat. How defensible is the Mediterranean
lead against Chipotle, Sweetgreen, the new entrants? How much pricing power is left?

**Researcher:** The category lead is real, they're effectively defining Mediterranean
fast-casual the way Chipotle did with burritos, and the new entrants are subscale on real
estate and supply chain. On pricing, after the double-digit increases I'd say they're closer
to the end of the easy pricing than the start. That's the watch item.

> ⚪→🟢 **Q6 answered.** ✎ Reinforces the Q4 flag — pricing runway is closing, so the
> price-led comp is *not repeatable*.

---

**Analyst — Q8 (capital allocation):** Last of my main ones, is all this growth self-funded,
or do they need to raise? Any appetite for M&A or buybacks?

**Researcher:** Self-funded. Operating cash flow covers the build, no equity raise needed in
the model, and the balance sheet's clean. No real M&A or buyback appetite, they're
reinvesting everything into new units, which is the right call at these returns.

> ⚪→🟢 **Q8 answered.** Q1–Q6 and Q8 green. **⚪ Q7 (catering) is still grey. ~90s left.**

---

**Analyst — Q7 (catering / new formats), prompted by the copilot nudge** *("Q7 still
uncovered — ~90s left")*: Before we run out of time, one I haven't hit: catering, and any
newer formats. What's the read on the catering rollout, and is there anything on
smaller-format or new-daypart prototypes?

**Researcher:** Catering's an underrated layer, it's growing nicely as an incremental
occasion with attractive economics, and they're testing a smaller-format prototype and a
new-daypart, breakfast-style concept. But those are early and not in anyone's numbers yet, so
call it free optionality.

> ⚪→🟢 **Q7 answered. ALL 8 GREEN. Zero holes.**

---

**Analyst — wrap:** That's everything on my list. I appreciate you being straight on the
new-unit AUV and the price-versus-traffic mix, that was really helpful.

> ✎ **Thesis auto-updates on hang-up:** Thesis intact but de-rated on quality. New-unit AUV
> lowered to ~$2.4M (margin ~18%); comp reclassified price-led, not traffic-led; pricing
> power near its limit. Growth, funding, and moat confirmed; catering optionality intact.
> **Net: lower the new-unit AUV, downgrade comp quality, re-test the premium multiple.**

---

## What the demo proves

You went in with eight questions. You covered every one. The copilot caught the dodge on
new-unit AUV and forced the real number, flagged that "traffic-led" comp is actually
price-led against their own note, and wouldn't let you hang up with catering uncovered. The
analyst ran the call; the copilot did the tracking and retrieval and wrote the thesis update.
