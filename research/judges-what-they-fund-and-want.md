# Who's Judging Argus — What They Fund, What They Believe, How to Win Them

Created: 2026-06-06
Event: YC Conversational AI Hackathon (Moss, F25) · June 6–7, 2026
For: [Argus diligence-call copilot](../docs/diligence-call-copilot-plan.md) · [demo storyboard](../docs/demo-storyboard.md)

The three people most likely in the room with skin in the game: **Pete Koomen** (Moss's YC
partner, the "interview" prize), the **two Moss founders** (host), and the **LiveKit** team
(headline sponsor, $1B voice-infra company). This doc is their actual worldviews + the
practical build/pitch moves that make Argus land with each.

---

## 1. Pete Koomen — YC partner, ex-Optimizely (the prize partner)

**Background.** Co-founded Optimizely (W10), grew it through enterprise to $100M+ ARR; now
General Partner / Visiting Group Partner at YC and an active angel. He has a YC Office Hours
episode specifically on **enterprise sales / GTM for AI products**. ([YC profile](https://www.ycombinator.com/people/pete-koomen), [enterprise-sales Office Hours](https://creators.spotify.com/pod/profile/ycombinator/episodes/Enterprise-Sales-with-Pete-Koomen--Startup-School-e2r2ufb))

**His one big idea — "AI Horseless Carriages."** His widely-read essay argues most AI apps
are bad because they **bolt AI onto old software patterns**. Two thesis points that matter
for us ([koomen.dev](https://koomen.dev/essays/horseless-carriages/), [Slashdot summary](https://it.slashdot.org/story/25/04/25/1545223/yc-partner-argues-most-ai-apps-are-currently-horseless-carriages)):

1. **Build "agent builders," not agents** — let the *user own the system prompt* and teach
   the AI their own preferences, instead of a one-size-fits-all bot.
2. **Use AI to *read*, not to write slop.** His hero demo isn't an email *writer* — it's an
   email *reader* that triages, prioritizes, and drafts per the user's own rules. Generic
   AI-generated prose he calls "AI Slop."

**How Argus wins him (this is the strongest single alignment we have):**
- **Frame Argus as an agent-builder, not an agent.** The analyst *loads their own question
  list and thesis* — that **is** the user-owned system prompt. Make the demo show the analyst
  authoring/loading their questions before the call (Scene 3 already does — lean into it,
  maybe a 2-second "type a question → it becomes a tracked chip"). Say the line: *"Argus
  isn't a generic bot — every analyst teaches it exactly what they need answered."*
- **Argus *reads*, it doesn't write slop.** It listens and scores coverage; it never
  generates an email or speaks on the call. That is literally his email-reader example applied
  to a live conversation. The one thing it *does* write — the follow-up — is grounded in a
  retrieved number, not generic prose. Call that out: *"No AI slop. It surfaces your own
  research at the right moment; you stay the analyst."*
- **Lead with the enterprise-sales/distribution story.** This is his Optimizely wheelhouse.
  "Founding engineers at WithAI, ships into Multiplier, funds already paying us (~$300M)" is
  exactly the GTM credibility he rewards. Keep it in Scene 1 and the close.

---

## 2. Moss — Sri Raghu Malireddi (CEO) & Harsha Nalluru (CTO), InferEdge Inc. (the host)

**Background.** Raghu: ex-ML at Grammarly + Microsoft. Harsha: **architected the core Azure
SDK** (400+ cloud services, 100M+ weekly npm downloads) — i.e. he cares about clean SDKs,
DX, and real production infra, not toys. Founded 2024, YC F25. ([Moss · YC](https://www.ycombinator.com/companies/moss), [Dealroom](https://app.dealroom.co/companies/moss_6))

**Their one big idea.** *"Voice models are now cheap and fast — they're no longer the
bottleneck. Retrieval is."* Moss is **sub-10ms on-device semantic search** for real-time AI.
([Moss · YC](https://www.ycombinator.com/companies/moss), [moss.dev](https://www.moss.dev/))

**How Argus wins them:**
- **Make retrieval the visible hero, and make it load-bearing.** The Q2 follow-up *only works
  because* Moss pulled our own $2.6M AUV note mid-sentence. Don't let Moss be a logo in the
  pipeline slide — put the retrieval on screen *as the researcher is still talking*, and show
  the latency number ("grounded in ~4ms"). This is a live, on-stage proof of their entire
  pitch: voice is solved, retrieval is the unlock.
- **Mid-conversation, not pre/post.** Our whole wedge ("async stack vs. the live call") *is*
  their thesis restated. Say it in their words: *"Voice was never the hard part. Knowing
  whether that answer was actually good — in the moment — is. That's retrieval."*
- **Respect the infra.** Harsha will notice if we use the SDK well. Use the starter's Moss
  spine cleanly (knowledge + memory indexes) rather than hacking around it.

---

## 3. LiveKit — Russ d'Sa & David Zhao (headline sponsor)

**Where they are.** Just raised a **$100M Series C at a $1B valuation** (Index Ventures, +
Salesforce Ventures, Altimeter, Redpoint). They power **OpenAI's ChatGPT voice mode** and
partner with Salesforce (Agentforce) and SAP (Joule). ([TechCrunch](https://techcrunch.com/2026/01/22/voice-ai-engine-and-openai-partner-livekit-hits-1b-valuation/), [Series C post](https://blog.livekit.io/livekit-series-c/))

**Their one big idea — "the voice-driven era of computing."** Voice AI apps are **realtime
and stateful** — a conversation runs minutes-to-hours with the agent "continuously listening,
thinking, and responding while maintaining context across the entire session." The whole
stack (build/test/deploy/monitor) has to be rebuilt for that. ([Series C post](https://blog.livekit.io/livekit-series-c/))

**What they're explicitly excited about (the use cases they name themselves):** financial
services is **first in their vertical list**, plus claims processing (Liberate), patient
triage (Assort Health), tutoring (Coursera), customer support (GigaML), **interviewing
candidates** (micro1), Tesla, Salesforce. ([Series C post](https://blog.livekit.io/livekit-series-c/), [livekit.com](https://livekit.com/))

**How Argus wins them:**
- **Speak their "realtime + stateful" language.** Argus's coverage state machine is exactly
  their pitch: persistent session context maintained across a multi-minute live call, updated
  every turn. Say *"realtime and stateful — the call has state, and Argus holds it."*
- **We're in their named vertical.** Financial-services voice is top of their list. A
  buy-side diligence call is squarely in the wave they just raised $100M on.
- **Use the full stack, visibly.** STT + data packets is the floor. Add the **Qwen earpiece
  cue** (Argus's one spoken output) so we're not *only* using LiveKit as a transcriber — it
  shows we can close the realtime loop. Optionally tease a "fully-autonomous mode" where
  Argus voices the follow-up itself (kept off by default for the buy-side safety story).

---

## The synthesis — three moves that hit all three at once

1. **"Load your own questions" is the whole pitch.** It's Koomen's user-owned system prompt,
   Moss's retrieval-driven scoring, and LiveKit's stateful session — one design decision that
   speaks to all three. Make the authoring/loading moment unmissable in the demo.
2. **Retrieval visible and live.** The Q2 follow-up grounded in our own note, on screen,
   sub-10ms, while the researcher is still talking. Proves Moss's thesis and gives the wow.
3. **Real customer, real distribution.** "Ships into Multiplier, funds already paying us" is
   the GTM credibility Koomen rewards and the enterprise traction LiveKit's whole Series C is
   about. Keep it the bookend.

**The one risk to manage:** Argus is a *silent* copilot, so it doesn't show off LiveKit's
full agent loop (no TTS / turn-taking on the call). Mitigate with the Qwen earpiece cue and a
one-line "and the same stack can run the call autonomously when you want it to" — so LiveKit
sees we *could* use everything, while we keep the silent design as the defensible buy-side
choice.

---

## Sources
- Koomen: [AI Horseless Carriages](https://koomen.dev/essays/horseless-carriages/) · [YC profile](https://www.ycombinator.com/people/pete-koomen) · [enterprise-sales Office Hours](https://creators.spotify.com/pod/profile/ycombinator/episodes/Enterprise-Sales-with-Pete-Koomen--Startup-School-e2r2ufb) · [Slashdot summary](https://it.slashdot.org/story/25/04/25/1545223/yc-partner-argues-most-ai-apps-are-currently-horseless-carriages)
- Moss: [Moss · YC](https://www.ycombinator.com/companies/moss) · [moss.dev](https://www.moss.dev/) · [Dealroom](https://app.dealroom.co/companies/moss_6)
- LiveKit: [Series C: the voice-driven era](https://blog.livekit.io/livekit-series-c/) · [TechCrunch — $1B](https://techcrunch.com/2026/01/22/voice-ai-engine-and-openai-partner-livekit-hits-1b-valuation/) · [livekit.com](https://livekit.com/)
