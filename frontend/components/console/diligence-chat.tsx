'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowClockwiseIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  PaperPlaneRightIcon,
  SparkleIcon,
} from '@phosphor-icons/react/dist/ssr';
import { type ConsoleModel, pillarGroups } from '@/lib/console-model';
import { cn } from '@/lib/shadcn/utils';

type ProviderId = 'minimax' | 'qwen';
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Streamed chain-of-thought for reasoning models (MiniMax), shown collapsed. */
  reasoning?: string;
}

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'minimax', label: 'MiniMax' },
  { id: 'qwen', label: 'Qwen' },
];

const SUGGESTIONS = [
  'Summarize the call so far',
  "What's still open?",
  'Any red flags or contradictions?',
  'What should I ask next?',
];

const MAX_CONTEXT = 16000;

/**
 * Flatten the live ConsoleModel into a compact, model-readable digest of the call:
 * company, coverage tally, the diligence questions grouped by pillar with their
 * state, open follow-ups, flagged contradictions, the Moss-retrieved notes/filings
 * (model.evidence — what the agent pulled from the analyst's research), and the
 * recent transcript. This is what grounds the chat answers (the "this meeting"
 * Granola reads from). The structured + Moss sections are kept in full; only the
 * transcript is trimmed to the most-recent turns that fit the remaining budget.
 */
function buildContext(model: ConsoleModel): string {
  const head: string[] = [];
  const c = model.company;
  head.push(
    `Company: ${c.name || 'unknown'}${c.ticker ? ` (${c.ticker})` : ''}${c.exchange ? ` · ${c.exchange}` : ''}`
  );
  head.push(`Call: ${model.callKind} — ${model.live ? 'LIVE, in progress' : 'ENDED'}`);
  head.push(
    `Coverage: ${model.tally.answered} answered · ${model.tally.partial} thin · ${model.tally.unanswered} open (of ${model.tally.total})`
  );

  const groups = pillarGroups(model);
  if (groups.length) {
    head.push('', 'DILIGENCE QUESTIONS & COVERAGE:');
    for (const g of groups) {
      head.push(`[${g.id}] ${g.label}${g.claim ? `: ${g.claim}` : ''}`);
      for (const q of g.questions) {
        const state = (model.coverage[q.id] ?? 'unanswered').toUpperCase();
        head.push(`  - (${state}) ${q.id}: ${q.text}`);
      }
    }
  }

  if (model.activeFollowups.length) {
    head.push('', 'OPEN FOLLOW-UPS TO ASK:');
    for (const f of model.activeFollowups) head.push(`  - ${f.questionId}: ${f.text}`);
  }
  if (model.flags.length) {
    head.push('', 'CONTRADICTIONS FLAGGED:');
    for (const f of model.flags) head.push(`  - ${f.questionId} (vs ${f.vs}): ${f.detail}`);
  }

  // Moss retrieval: the analyst's own notes/filings the agent surfaced during the
  // call (model.evidence), plus any facts it extracted. De-duped across turns.
  const notes: string[] = [];
  const facts: string[] = [];
  const seenNote = new Set<string>();
  const seenFact = new Set<string>();
  for (const e of model.evidence) {
    for (const s of e.sources) {
      const key = s.text.trim();
      if (!key || seenNote.has(key)) continue;
      seenNote.add(key);
      const score = typeof s.score === 'number' ? ` ${s.score.toFixed(2)}` : '';
      notes.push(`  - [${s.label}${score}] ${s.text}`);
    }
    for (const f of e.facts) {
      const key = f.trim();
      if (!key || seenFact.has(key)) continue;
      seenFact.add(key);
      facts.push(`  - ${f}`);
    }
  }
  if (notes.length) head.push('', 'RESEARCH NOTES & FILINGS (retrieved from Moss):', ...notes);
  if (facts.length) head.push('', 'FACTS EXTRACTED FROM THE CALL:', ...facts);

  // Transcript fills whatever budget remains, most-recent-first so the latest turns
  // always make it in even on a long call.
  const headText = head.join('\n');
  let budget = Math.max(2500, MAX_CONTEXT - headText.length);
  const kept: string[] = [];
  const turns = model.transcript;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    const line = `  ${t.speaker === 'analyst' ? 'ANALYST' : 'RESEARCHER'}: ${t.text}`;
    budget -= line.length + 1;
    if (budget < 0) break;
    kept.unshift(line);
  }

  return `${headText}\n\nTRANSCRIPT (most recent last):\n${kept.join('\n')}`;
}

// ---- Minimal markdown for assistant replies ----
// streamdown (a dependency) needs Tailwind-source wiring we don't have, so this
// renders the small subset the chat models actually emit — bold, inline code, and
// bullet / numbered lists — with explicit classes (preflight strips list markers).
// Re-runs per streamed token; unterminated **/` mid-stream stay literal until closed.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-zinc-100">
          {m[1]}
        </strong>
      );
    } else {
      out.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px] text-emerald-200"
        >
          {m[2]}
        </code>
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flush = () => {
    if (!list) return;
    const { ordered, items } = list;
    blocks.push(
      <ul key={`l${key++}`} className="list-none space-y-0.5">
        {items.map((it, j) => (
          <li key={j} className="flex gap-1.5">
            <span className="mt-px shrink-0 text-emerald-400/70 tabular-nums">
              {ordered ? `${j + 1}.` : '•'}
            </span>
            <span className="min-w-0">{renderInline(it, `li${key}-${j}`)}</span>
          </li>
        ))}
      </ul>
    );
    list = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const num = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet) {
      if (list?.ordered) flush();
      (list ??= { ordered: false, items: [] }).items.push(bullet[1]);
    } else if (num) {
      if (list && !list.ordered) flush();
      (list ??= { ordered: true, items: [] }).items.push(num[1]);
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      blocks.push(<p key={`p${key++}`}>{renderInline(line, `p${key}`)}</p>);
    }
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}

/**
 * Collapsible chain-of-thought trace for reasoning models (MiniMax). Streams the
 * model's thinking live in a dimmed panel, then auto-collapses to a "thought
 * process" toggle the moment the real answer starts — re-expandable by click.
 */
function ThinkingTrace({
  text,
  answering,
  streaming,
}: {
  text: string;
  answering: boolean;
  streaming: boolean;
}) {
  // Open live while the model is still only thinking; collapse once the answer
  // begins. A manual toggle takes over from then on.
  const [open, setOpen] = useState(true);
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current && answering) setOpen(false);
  }, [answering]);

  const thinking = streaming && !answering;
  return (
    <div className="mb-1.5 w-full max-w-[90%]">
      <button
        type="button"
        onClick={() => {
          touched.current = true;
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1 font-mono text-[9px] tracking-[0.12em] text-zinc-600 transition-colors hover:text-zinc-400"
      >
        <CaretRightIcon
          weight="bold"
          className={cn('size-2.5 transition-transform', open && 'rotate-90')}
        />
        {thinking ? (
          <span className="flex items-center gap-1.5 text-zinc-500">
            THINKING
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="size-1 rounded-full bg-zinc-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }}
                />
              ))}
            </span>
          </span>
        ) : (
          'THOUGHT PROCESS'
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-1 border-l-2 border-white/10 pl-2 text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-500">
              {text.trimStart()}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * "Ask about this call" chat — a Granola-style box that sits below the live-call
 * panel in the left console column. Grounded in the running transcript,
 * coverage state, and the Moss-retrieved notes/filings. Answers stream from a
 * sponsor model the analyst picks (MiniMax or Qwen) via /api/chat. Collapsible.
 */
export function DiligenceChat({ model }: { model: ConsoleModel }) {
  const [open, setOpen] = useState(true);
  const [provider, setProvider] = useState<ProviderId>('minimax');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stick to the bottom as tokens stream in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || streaming) return;
    setError(null);
    setInput('');
    const history = [...messages, { role: 'user' as const, content }];
    setMessages([...history, { role: 'assistant', content: '', reasoning: '' }]);
    setStreaming(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, context: buildContext(model), messages: history }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Chat failed (${res.status})`);
      }

      // NDJSON: one {type, text} per line. `think` deltas grow the collapsible
      // reasoning trace; `text` deltas grow the visible answer bubble.
      const apply = (evt: { type?: string; text?: string }) => {
        if (!evt.text) return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] =
            evt.type === 'think'
              ? { ...last, reasoning: (last.reasoning ?? '') + evt.text }
              : { ...last, content: last.content + evt.text };
          return next;
        });
      };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try {
            apply(JSON.parse(t));
          } catch {
            // partial frame — newline framing makes this rare; skip it.
          }
        }
      }
      const tail = buf.trim();
      if (tail) {
        try {
          apply(JSON.parse(tail));
        } catch {
          // ignore a trailing partial
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat failed');
      // Drop the empty assistant bubble we optimistically added.
      setMessages((prev) =>
        prev.length && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content
          ? prev.slice(0, -1)
          : prev
      );
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <section className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0d12]">
      {/* Header: title toggle + model picker */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2"
        >
          <CaretRightIcon
            weight="bold"
            className={cn('size-3 text-zinc-500 transition-transform', open && 'rotate-90')}
          />
          <ChatCircleDotsIcon weight="fill" className="size-3.5 text-emerald-400/80" />
          <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
            Ask about this call
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="mr-1 flex items-center gap-1 font-mono text-[9px] tracking-wide text-zinc-600 hover:text-zinc-400"
              aria-label="Clear chat"
            >
              <ArrowClockwiseIcon weight="bold" className="size-3" />
              CLEAR
            </button>
          )}
          <div className="flex items-center rounded-md border border-white/10 bg-black/30 p-0.5">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                aria-pressed={provider === p.id}
                className={cn(
                  'rounded-[5px] px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wide transition-colors',
                  provider === p.id
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="min-h-0 overflow-hidden"
          >
            {/* Messages */}
            <div ref={scrollRef} className="max-h-[30vh] min-h-[88px] overflow-y-auto px-3 py-3">
              {empty ? (
                <div className="space-y-2.5">
                  <p className="text-[12px] leading-snug text-zinc-500">
                    Ask anything about the call — grounded in the live transcript, coverage, flags,
                    and your Moss notes. Answered by{' '}
                    <span className="text-zinc-300">
                      {provider === 'minimax' ? 'MiniMax' : 'Qwen'}
                    </span>
                    .
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] hover:text-emerald-200"
                      >
                        <SparkleIcon weight="fill" className="size-2.5 text-emerald-400/70" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => {
                    const self = m.role === 'user';
                    const isLast = i === messages.length - 1;
                    const reasoning = !self ? (m.reasoning ?? '').trim() : '';
                    const pending = streaming && isLast && !m.content && !reasoning;
                    return (
                      <div
                        key={i}
                        className={cn('flex flex-col', self ? 'items-end' : 'items-start')}
                      >
                        <span className="mb-0.5 px-1 font-mono text-[9px] tracking-[0.12em] text-zinc-600">
                          {self ? 'YOU' : provider === 'minimax' ? 'MINIMAX' : 'QWEN'}
                        </span>

                        {reasoning && (
                          <ThinkingTrace
                            text={m.reasoning ?? ''}
                            answering={Boolean(m.content)}
                            streaming={streaming && isLast}
                          />
                        )}

                        {(self || m.content || pending) && (
                          <div
                            className={cn(
                              'max-w-[90%] px-3 py-2 text-[12px] leading-relaxed',
                              self
                                ? 'rounded-l-lg rounded-tr-lg border-r-2 border-emerald-400/50 bg-emerald-400/10 whitespace-pre-wrap text-emerald-50/90'
                                : 'rounded-tl-lg rounded-r-lg border-l-2 border-white/15 bg-white/[0.04] text-zinc-300'
                            )}
                          >
                            {pending ? (
                              <span className="inline-flex gap-1">
                                {[0, 1, 2].map((d) => (
                                  <motion.span
                                    key={d}
                                    className="size-1.5 rounded-full bg-zinc-500"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{
                                      duration: 1,
                                      repeat: Infinity,
                                      delay: d * 0.18,
                                    }}
                                  />
                                ))}
                              </span>
                            ) : self ? (
                              m.content
                            ) : (
                              <Markdown text={m.content} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {error && (
                <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/[0.08] px-2.5 py-1.5 font-mono text-[11px] leading-snug text-red-300">
                  {error}
                </p>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-white/[0.08] px-3 py-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={streaming}
                placeholder="Ask about the call…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                aria-label="Send"
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-black transition-colors hover:bg-zinc-200 disabled:opacity-30"
              >
                <PaperPlaneRightIcon weight="fill" className="size-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
