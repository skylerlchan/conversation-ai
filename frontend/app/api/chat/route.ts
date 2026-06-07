import { NextResponse } from 'next/server';
import { type ChatRole, buildSystemPrompt, resolveProvider } from '@/lib/chat';
import { formatMossDocs, mossConfigured, queryMoss } from '@/lib/moss';

export const maxDuration = 60;

interface ChatBody {
  provider?: string;
  /** Digest of the current call (transcript + coverage), built on the client. */
  context?: string;
  messages?: { role: ChatRole; content: string }[];
}

/** Longest suffix of `s` that is a (strict) prefix of `tag` — a possibly-incomplete tag. */
function partialTagSuffix(s: string, tag: string): number {
  for (let k = Math.min(s.length, tag.length - 1); k > 0; k--) {
    if (s.slice(s.length - k) === tag.slice(0, k)) return k;
  }
  return 0;
}

/**
 * Splits a reasoning model's token stream into two channels: chain-of-thought (the
 * text inside `<think>…</think>`) and the user-facing answer. MiniMax-M2/M3 emit
 * their thinking inline in delta.content and the tags straddle chunk boundaries, so
 * this is stateful: feed each delta, get back `{ think, answer }` for that delta.
 * `flush` releases whatever is held back once the stream ends. Providers that never
 * emit think tags (e.g. Qwen) return everything as `answer`.
 */
function makeThinkSplitter() {
  const OPEN = '<think>';
  const CLOSE = '</think>';
  let inThink = false;
  let carry = '';

  return {
    feed(text: string): { think: string; answer: string } {
      carry += text;
      let think = '';
      let answer = '';
      for (;;) {
        if (!inThink) {
          const i = carry.indexOf(OPEN);
          if (i !== -1) {
            answer += carry.slice(0, i);
            carry = carry.slice(i + OPEN.length);
            inThink = true;
            continue;
          }
          const hold = partialTagSuffix(carry, OPEN);
          answer += carry.slice(0, carry.length - hold);
          carry = carry.slice(carry.length - hold);
          return { think, answer };
        }
        const i = carry.indexOf(CLOSE);
        if (i !== -1) {
          think += carry.slice(0, i);
          carry = carry.slice(i + CLOSE.length);
          inThink = false;
          continue;
        }
        const hold = partialTagSuffix(carry, CLOSE);
        think += carry.slice(0, carry.length - hold);
        carry = carry.slice(carry.length - hold);
        return { think, answer };
      }
    },
    flush(): { think: string; answer: string } {
      const out = inThink ? { think: carry, answer: '' } : { think: '', answer: carry };
      carry = '';
      return out;
    },
  };
}

// Granola-style "ask about this call" chat. Proxies to the chosen sponsor model
// (MiniMax or Qwen) over its OpenAI-compatible /chat/completions endpoint and
// re-streams the token deltas to the browser as plain text.
export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const provider = resolveProvider(body.provider);
  const messages = (body.messages ?? []).filter((m) => m.content?.trim());
  if (!messages.length) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400 });
  }

  const apiKey = process.env[provider.keyEnv];
  if (!apiKey) {
    return NextResponse.json(
      {
        error: `${provider.label} is not configured — set ${provider.keyEnv} in frontend/.env.local`,
      },
      { status: 503 }
    );
  }

  // Live Moss retrieval: run a fresh semantic search of the knowledge corpus with the
  // latest question and fold the hits into the context. Best-effort — if Moss is down
  // or unconfigured the chat still answers from the surfaced call context.
  let context = body.context ?? '';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (mossConfigured() && lastUser) {
    try {
      const docs = await queryMoss(lastUser);
      const block = formatMossDocs(docs);
      if (block) {
        context += `\n\nMOSS SEARCH RESULTS FOR THIS QUESTION (live query of the knowledge corpus — filings & notes, most relevant first):\n${block}`;
      }
    } catch (e) {
      console.error('Moss query failed; answering from surfaced context only:', e);
    }
  }

  const payload = {
    model: provider.model,
    stream: true,
    temperature: 0.4,
    messages: [
      { role: 'system', content: buildSystemPrompt(context) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not reach ${provider.label}: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { error: `${provider.label} error ${upstream.status}: ${detail.slice(0, 300)}` },
      { status: 502 }
    );
  }

  // Re-stream the upstream SSE as NDJSON — one JSON object per line, tagged either
  // {"type":"think",…} (chain-of-thought) or {"type":"text",…} (the answer). The
  // client renders think tokens into a collapsible trace and text into the bubble.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const split = makeThinkSplitter();
      const emit = (type: 'think' | 'text', text: string) => {
        if (text) controller.enqueue(encoder.encode(`${JSON.stringify({ type, text })}\n`));
      };
      const emitSplit = (s: { think: string; answer: string }) => {
        emit('think', s.think);
        emit('text', s.answer);
      };
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') {
              emitSplit(split.flush());
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta;
              // Some OpenAI-compatible reasoning models surface thinking on a separate
              // `reasoning_content` field instead of inline <think> tags — route it too.
              const reasoning = delta?.reasoning_content;
              if (typeof reasoning === 'string' && reasoning) emit('think', reasoning);
              const content = delta?.content;
              if (typeof content === 'string' && content) emitSplit(split.feed(content));
            } catch {
              // keep-alive line or a partial JSON frame — ignore.
            }
          }
        }
        emitSplit(split.flush());
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
