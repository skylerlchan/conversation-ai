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
 * Strips reasoning models' chain-of-thought from a token stream. MiniMax-M2 (and
 * other reasoning models) emit their thinking inline as `<think>…</think>` inside
 * delta.content, and the tags split across chunk boundaries — so this is a stateful
 * filter: feed each delta, get back only the user-facing text. `flush` emits any
 * text held back as a maybe-partial open tag once the stream ends. Providers that
 * never emit think tags (e.g. Qwen) pass straight through.
 */
function makeThinkStripper() {
  const OPEN = '<think>';
  const CLOSE = '</think>';
  let inThink = false;
  let carry = '';

  return {
    feed(text: string): string {
      carry += text;
      let out = '';
      for (;;) {
        if (!inThink) {
          const i = carry.indexOf(OPEN);
          if (i !== -1) {
            out += carry.slice(0, i);
            carry = carry.slice(i + OPEN.length);
            inThink = true;
            continue;
          }
          const hold = partialTagSuffix(carry, OPEN);
          out += carry.slice(0, carry.length - hold);
          carry = carry.slice(carry.length - hold);
          return out;
        }
        const i = carry.indexOf(CLOSE);
        if (i !== -1) {
          carry = carry.slice(i + CLOSE.length);
          inThink = false;
          continue;
        }
        // Still thinking: drop everything but a possible partial close tag.
        carry = carry.slice(carry.length - partialTagSuffix(carry, CLOSE));
        return out;
      }
    },
    flush(): string {
      const rest = inThink ? '' : carry;
      carry = '';
      return rest;
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

  // Re-stream the OpenAI-compatible SSE as bare text deltas (the client appends
  // each chunk to the in-flight assistant bubble).
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const strip = makeThinkStripper();
      const emit = (text: string) => {
        if (text) controller.enqueue(encoder.encode(text));
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
              emit(strip.flush());
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta) emit(strip.feed(delta));
            } catch {
              // keep-alive line or a partial JSON frame — ignore.
            }
          }
        }
        emit(strip.flush());
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
