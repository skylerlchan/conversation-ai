# Conversational AI Hackathon (YC / Moss) — Sponsors, Judges & What to Build

*Deep research compiled: June 6, 2026 (event day 1 of 2). Findings verified via multi-source adversarial fact-checking — 24 of 25 extracted claims confirmed.*

The **Conversational AI Hackathon** is a 24-hour event hosted by **Moss (YC F25 / InferEdge Inc.)** at the **Y Combinator office, San Francisco**, on **June 6–7, 2026**. First place wins an **interview with a YC partner**, plus iPhones and sponsor swag. ([YC event page](https://events.ycombinator.com/conversational-ai-hackathon-2026), [Pete Koomen on X](https://x.com/koomen/status/2060336454946185384))

> Correction to earlier notes: **Y Combinator is the venue host, not a product sponsor**, and there are **six product sponsors** (not the four named in early LinkedIn announcements). The full list comes from the raw JSON embedded in the official YC event page.

---

## 1. Sponsors (six product companies)

Confirmed verbatim from the YC event page's canonical description field. The four-company version (LiveKit, TrueFoundry, Unsiloed, MiniMax) appeared in Moss's LinkedIn announcements but was **incomplete** — AWS and Qwen were added on the authoritative page. ([YC event page](https://events.ycombinator.com/conversational-ai-hackathon-2026), [Moss CEO LinkedIn](https://www.linkedin.com/posts/r4ghu_moss-yc-f25-is-hosting-the-conversational-activity-7466155265046859776-aTA7), [Moss company LinkedIn](https://www.linkedin.com/posts/mossdev_were-excited-to-announce-the-conversational-activity-7467338070632173568-1Kop))

| Sponsor | What they do (per YC page) | Confidence |
|---|---|---|
| **LiveKit** | Real-time audio and video infrastructure | High (3-0) |
| **TrueFoundry** | AI gateway platform to control, govern, and scale AI agents | High (3-0) |
| **Unsiloed AI (F25)** | API for parsing PDFs and unstructured documents | High (3-0) |
| **AWS** | Cloud computing platform | High (primary source; 2-1) |
| **MiniMax** | "Intelligence with everyone" — voice/intelligence models | High (primary source; 2-1) |
| **Qwen** | Voice Design, Clone and Generation | High (primary source; 2-1) |

> AWS and Qwen are confirmed by the primary YC page but carried one dissenting verification vote (they were absent from the earlier announcements), so they are marginally less corroborated than the other four.

### What each sponsor enables (product detail + realistic builds)

**LiveKit — real-time transport for voice agents.**
WebRTC-based audio/video infrastructure; its Agents framework is a standard backbone for production voice bots (handling mic capture, streaming, turn-taking). Moss even publishes a LiveKit starter repo for this hackathon: [`livekit-examples/moss-hacker-starter`](https://github.com/livekit-examples/moss-hacker-starter).
*Build:* the real-time voice pipeline — user speaks → STT → LLM → TTS → response, with LiveKit carrying the live audio.

**TrueFoundry — AI gateway / control plane.**
A gateway to route, govern, observe, and scale calls across many models and agents (rate limiting, fallback, cost/latency control, observability).
*Build:* a multi-model router behind your agent — e.g., fail over between MiniMax/Qwen/other LLMs, log every turn, enforce budgets — useful for any team running more than one model.

**Unsiloed AI (F25) — document ingestion for RAG.** (most fully documented sponsor)
Turns PDFs, images, and spreadsheets into structured JSON/Markdown that LLMs and agents can reason over. Three capabilities: **Parse** (docs → LLM-ready Markdown preserving tables/figures/hierarchy), **Extract** (fields → JSON via schema), **Split** (multi-doc files → retrievable parent/child chunks). Live REST API (`POST https://prod.visionapi.unsiloed.ai/parse`, job-based polling), delivered over HTTPS with optional VPC peering. ([unsiloed.ai](https://www.unsiloed.ai/), [API docs](https://docs.unsiloed.ai/api-reference/parser/parse-document), [Unsiloed on YC](https://www.ycombinator.com/companies/unsiloed-ai))
*Build:* a voice/chat agent that ingests user-uploaded documents (filings, claims, contracts, credit memos) → Unsiloed parses them → Moss indexes them → the agent answers questions in real time. This is the canonical "talk to your documents" build.

**AWS — cloud + model access.**
Hosting/compute, and likely Bedrock model access plus credits (inference). *Build:* deploy your backend; use Bedrock-hosted models or AWS speech services as the LLM/STT/TTS layer.

**MiniMax — voice + LLM models.**
AI lab offering capable LLMs and high-quality voice (TTS / text-to-audio, voice cloning). *Build:* the "brain" and/or the "voice" of your agent — generate responses and speak them. (Note: the MiniMax×YC press release about a *Browser-Use* hackathon on Feb 28, 2026 is a **different event** — do not conflate.)

**Qwen — voice design, cloning, generation.**
Alibaba's model family; here specifically the voice stack — design a custom voice, clone a voice, generate speech. *Build:* expressive/custom TTS, or a voice-cloned persona for your agent.

> AWS, MiniMax, and Qwen specifics (exact credits, API keys, sponsor-prize tracks) were **not published** on primary sources — what each provides on-site is inferred from their products. See Open Questions.

---

## 2. Judges

**No formal judging panel was published on any primary source.** This is the weakest-answered part of the brief — treat the people below as *likely* judges, not a confirmed panel.

The only explicit prize mechanism is **"an interview with a YC partner"** ([Pete Koomen on X](https://x.com/koomen/status/2060336454946185384)). The strongly-implied judges:

| Person | Role | Background | Status |
|---|---|---|---|
| **Pete Koomen** | YC partner — Moss's **primary partner** | Confirmed YC partner; publicly promoted the event | Likely judge / the "YC partner interview" partner (inferred) |
| **Sri Raghu Malireddi** | Moss **Founder & CEO** | Ex-ML Lead at Grammarly and Microsoft | Likely judge/organizer (inferred) |
| **Harsha Nalluru** | Moss **Co-founder & CTO** | Ex-Azure SDK Tech Lead at Microsoft | Likely judge/organizer (inferred) |

Sources: [Moss on YC](https://www.ycombinator.com/companies/moss) (lists "Batch: Fall 2025", "Primary Partner: Pete Koomen", and both founders), [Pete Koomen YC profile](https://www.ycombinator.com/people/pete-koomen), [Sri Raghu Malireddi LinkedIn](https://www.linkedin.com/in/r4ghu/). Identities, titles, and affiliations are confirmed 3-0; their *judge* role is an inference. Sponsors (LiveKit/TrueFoundry/Unsiloed/AWS/MiniMax/Qwen) may also send judges or technical mentors, but this is unconfirmed.

---

## 3. The host's own tech — Moss (shapes what's buildable)

Moss is a **real-time semantic search runtime** for AI agents, voice agents, copilots, and multimodal apps — built in **Rust and WebAssembly**, running on-device with "zero infrastructure." Its thesis: *"Voice models are now cheap and fast. They're no longer the bottleneck. Retrieval is."* ([moss.dev](https://www.moss.dev/), [Moss on YC](https://www.ycombinator.com/companies/moss), [Launch YC](https://www.ycombinator.com/launches/Oiq-moss-real-time-semantic-search-for-conversational-ai))

- **Latency:** self-reported **sub-10ms** retrieval (GitHub benchmark: 100k docs → P50 3.1ms, P95 4.3ms, P99 5.4ms on an M4 Pro, embedding time included). This is a **vendor benchmark** requiring an in-memory loaded index (`loadIndex()`); the cloud-API fallback path is ~100–500ms. Not independently audited — report as Moss's stated performance, not fact. ([GitHub: usemoss/moss](https://github.com/usemoss/moss), [docs.moss.dev](https://docs.moss.dev/docs))
- **SDKs (6):** JavaScript/TypeScript, Python, Swift/iOS, Elixir, C (`libmoss`), Browser/WASM — all shipped, none beta. ([docs.moss.dev](https://docs.moss.dev/docs))
- **Integrations (all listed "Available"):** voice frameworks **LiveKit, Pipecat, ElevenLabs, VAPI, Agora**; agent stacks **LangChain, LlamaIndex, CrewAI, AutoGen, Haystack, Mastra, Pydantic AI, DSPy, Strands Agents**; plus **Vercel AI SDK, Next.js, and a Moss MCP Server**. ([GitHub: usemoss/moss](https://github.com/usemoss/moss))

The overlap between Moss's integrations and the sponsor list (LiveKit; MiniMax/Qwen voice) points to the **canonical winning build**: a sponsor-stack voice agent grounded by Moss's instant retrieval.

### Reference build (the "intended path")
`LiveKit` (real-time audio transport) → `MiniMax`/`Qwen` or `AWS Bedrock` (LLM + voice) → `Unsiloed` (ingest user docs) → `Moss` (sub-10ms mid-conversation knowledge lookup) → optionally `TrueFoundry` (gateway/observability across models). Starter: [`livekit-examples/moss-hacker-starter`](https://github.com/livekit-examples/moss-hacker-starter).

---

## Caveats & open questions

**Caveats**
- **Judges are inferred, not published.** Only the "YC partner interview" prize and Pete Koomen's promotion are confirmed.
- **Sponsor count corrected:** six product sponsors (AWS + Qwen were missing from early announcements); YC is venue host only.
- **Moss "sub-10ms" is a vendor self-benchmark** (M4 Pro, in-memory index, embedding included); marketing lines like "the latency is gone" are positioning.
- **Refuted (do not report):** a detailed prize tier of "2nd = AirPods Max, 3rd = AirPods Pro" failed verification (1-2). Confirmed prizes are only: 1st = YC partner interview, plus iPhones and swag.

**Open questions (verify on-site)**
1. Who are the **actual named judges**? Is Koomen the interviewing partner? Do sponsors each send a judge/mentor?
2. What exactly do **AWS, MiniMax, and Qwen** provide participants (credits, API keys, sponsor prize tracks)?
3. What is the **full prize structure** beyond 1st place?
4. Any **last-minute sponsor changes** between the page snapshot and event day?

---

## Sources
- [Conversational AI Hackathon | Y Combinator](https://events.ycombinator.com/conversational-ai-hackathon-2026)
- [Pete Koomen on X — event announcement](https://x.com/koomen/status/2060336454946185384) · [Aman (Unsiloed) on X — sponsor/prizes](https://x.com/aman_unsiloed/status/2061337831021420879)
- [Moss CEO LinkedIn](https://www.linkedin.com/posts/r4ghu_moss-yc-f25-is-hosting-the-conversational-activity-7466155265046859776-aTA7) · [Moss company LinkedIn](https://www.linkedin.com/posts/mossdev_were-excited-to-announce-the-conversational-activity-7467338070632173568-1Kop)
- [Moss on YC](https://www.ycombinator.com/companies/moss) · [Pete Koomen YC profile](https://www.ycombinator.com/people/pete-koomen) · [Sri Raghu Malireddi LinkedIn](https://www.linkedin.com/in/r4ghu/)
- [moss.dev](https://www.moss.dev/) · [Moss docs](https://docs.moss.dev/docs) · [GitHub: usemoss/moss](https://github.com/usemoss/moss) · [Launch YC: Moss](https://www.ycombinator.com/launches/Oiq-moss-real-time-semantic-search-for-conversational-ai) · [LiveKit Moss starter repo](https://github.com/livekit-examples/moss-hacker-starter)
- [unsiloed.ai](https://www.unsiloed.ai/) · [Unsiloed API docs](https://docs.unsiloed.ai/api-reference/parser/parse-document) · [Unsiloed on YC](https://www.ycombinator.com/companies/unsiloed-ai)
