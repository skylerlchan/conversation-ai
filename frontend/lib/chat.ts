// Server-side config + prompt for the diligence chat assistant (the Granola-style
// "ask anything about this call" box under the live call). Both providers expose an
// OpenAI-compatible /chat/completions endpoint, so the route treats them uniformly;
// only the base URL, model id, and API-key env differ. Drop the sponsor keys into
// .env.local (MINIMAX_API_KEY / QWEN_API_KEY) and the box lights up.
import 'server-only';

export type ChatRole = 'user' | 'assistant';
export type ProviderId = 'minimax' | 'qwen';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** Env var holding the API key. */
  keyEnv: string;
  /** Resolved OpenAI-compatible base URL (…/chat/completions is appended). */
  baseUrl: string;
  /** Model id, overridable per-provider via env. */
  model: string;
}

// Base URLs / models are env-overridable so the demo isn't pinned to a model name
// that may rotate. Defaults are the current OpenAI-compatible endpoints:
//   MiniMax — https://api.minimax.io/v1            (platform.minimax.io OpenAI SDK docs)
//   Qwen    — DashScope international compatible-mode (Alibaba Model Studio)
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    keyEnv: 'MINIMAX_API_KEY',
    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
    model: process.env.MINIMAX_MODEL || 'MiniMax-M3',
  },
  qwen: {
    id: 'qwen',
    label: 'Qwen',
    keyEnv: 'QWEN_API_KEY',
    baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    model: process.env.QWEN_MODEL || 'qwen3-max',
  },
};

export function resolveProvider(id: string | undefined): ProviderConfig {
  return id === 'qwen' ? PROVIDERS.qwen : PROVIDERS.minimax;
}

const SYSTEM = `You are the diligence copilot's chat assistant — like Granola's "ask about this meeting", but for a buy-side hedge-fund analyst on a live diligence / earnings call. The analyst types questions and you answer from the call they are on.

Ground every answer in the LIVE CALL CONTEXT below: the running transcript, the diligence questions and their coverage state (answered / thin / open), open follow-ups, and any flagged contradictions. Quote or paraphrase what was actually said and reference questions by id (e.g. Q3) when relevant.

When a "MOSS SEARCH RESULTS FOR THIS QUESTION" block is present, it is a live semantic search of the analyst's knowledge corpus (the company's filings and research notes) run against this exact question — treat it as your source of record for facts about the company, and cite the bracketed source label (e.g. [AAPL 10-Q p.5]) when you use a snippet. If the search returned nothing relevant, say what the call itself shows and note the corpus had no match.

Rules:
- Be concise and direct — short paragraphs or tight bullets, not essays. This is read mid-call.
- If the call has not yet covered something, say so plainly ("Not covered yet — worth asking") instead of guessing. Never invent quotes, numbers, or facts that aren't supported by the context.
- You may use general financial knowledge to interpret what was said, but clearly separate "from the call" from your own read.
- When the analyst asks what to ask next or where the gaps are, prioritize OPEN/THIN questions and any flagged contradictions.
- No preamble like "Great question" — answer immediately.`;

/** Wrap the per-call context (transcript + coverage digest from the client) with the system prompt. */
export function buildSystemPrompt(context: string): string {
  const ctx =
    context.trim() ||
    '(The call has not produced any transcript yet — answer from general knowledge and say the call has not started.)';
  return `${SYSTEM}\n\n=== LIVE CALL CONTEXT ===\n${ctx}`;
}
