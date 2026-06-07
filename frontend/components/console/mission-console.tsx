'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react/dist/ssr';
import {
  type CopilotEvent,
  type CopilotEventType,
  useDiligenceDemo,
} from '@/hooks/useDiligenceDemo';
import { callFixture, questionsFixture } from '@/lib/demo';
import type { CoverageState } from '@/lib/demo/types';
import { cn } from '@/lib/shadcn/utils';

const ACCENT: Record<CopilotEventType, { bar: string; text: string }> = {
  grounding: { bar: 'bg-sky-400', text: 'text-sky-400' },
  followup: { bar: 'bg-amber-400', text: 'text-amber-400' },
  flag: { bar: 'bg-red-400', text: 'text-red-400' },
  thesis: { bar: 'bg-violet-400', text: 'text-violet-400' },
  nudge: { bar: 'bg-zinc-400', text: 'text-zinc-400' },
};

const STATE: Record<CoverageState, { label: string; dot: string; glow: string; text: string }> = {
  answered: {
    label: 'COVERED',
    dot: 'bg-emerald-400',
    glow: 'shadow-[0_0_12px_2px_rgba(52,211,153,0.55)]',
    text: 'text-emerald-400',
  },
  partial: {
    label: 'THIN',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_12px_2px_rgba(251,191,36,0.6)]',
    text: 'text-amber-400',
  },
  unanswered: {
    label: 'OPEN',
    dot: 'bg-zinc-600',
    glow: '',
    text: 'text-zinc-500',
  },
};

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
      {children}
    </h2>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.95, 0.65, 0.45, 0.8, 0.55];
  return (
    <div className="flex h-5 items-center gap-[3px]">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-emerald-400/80"
          animate={active ? { scaleY: [h, h * 0.3, h] } : { scaleY: 0.2 }}
          transition={
            active
              ? { duration: 0.7 + (i % 4) * 0.18, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.3 }
          }
          style={{ height: `${h * 20}px`, originY: 0.5 }}
        />
      ))}
    </div>
  );
}

// ---- Command bar ----

function CommandBar({
  ticker,
  company,
  exchange,
  callKind,
  answered,
  partial,
  total,
  live,
}: {
  ticker: string;
  company: string;
  exchange: string;
  callKind: string;
  answered: number;
  partial: number;
  total: number;
  live: boolean;
}) {
  const pct = (answered / total) * 100;
  return (
    <header className="flex items-center gap-4 border-b border-white/[0.06] px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          {live && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span
            className={cn(
              'relative inline-flex size-2.5 rounded-full',
              live ? 'bg-emerald-400' : 'bg-zinc-600'
            )}
          />
        </span>
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-emerald-400">
          {live ? 'LIVE' : 'ENDED'}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold tracking-tight text-white">{ticker}</span>
        <span className="text-sm text-zinc-400">{company}</span>
        <span className="font-mono text-[10px] tracking-wide text-zinc-600">{exchange}</span>
      </div>

      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] tracking-wide text-zinc-400">
        {callKind}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-sm font-semibold text-white tabular-nums">
            {answered}
            <span className="text-zinc-600">/{total}</span>
            <span className="ml-1 text-[10px] tracking-wide text-zinc-500">COVERED</span>
          </div>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {partial > 0 && (
          <span className="font-mono text-[10px] tracking-wide text-amber-400">{partial} THIN</span>
        )}
      </div>
    </header>
  );
}

// ---- Coverage rail (hero) ----

function CoverageRail({
  questions,
  coverage,
  followups,
  flags,
  allCovered,
}: {
  questions: typeof questionsFixture.questions;
  coverage: Record<string, CoverageState>;
  followups: ReturnType<typeof useDiligenceDemo>['activeFollowups'];
  flags: ReturnType<typeof useDiligenceDemo>['flags'];
  allCovered: boolean;
}) {
  const fuByQ = new Map(followups.map((f) => [f.questionId, f]));
  const flagByQ = new Map(flags.map((f) => [f.questionId, f]));

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <Label>Coverage · your questions</Label>
        {allCovered && (
          <span className="flex items-center gap-1 font-mono text-[10px] tracking-wide text-emerald-400">
            <CheckCircleIcon weight="fill" className="size-3" /> ZERO HOLES
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {questions.map((q, i) => {
          const s = coverage[q.id] ?? 'unanswered';
          const meta = STATE[s];
          const fu = fuByQ.get(q.id);
          const flag = flagByQ.get(q.id);
          return (
            <Panel
              key={q.id}
              className={cn(
                'p-3 transition-colors',
                s === 'answered' && 'border-emerald-400/20',
                s === 'partial' && 'border-amber-400/30'
              )}
            >
              <div className="flex items-start gap-3">
                <motion.span
                  key={`${q.id}-${s}`}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                  className={cn('mt-1 size-2.5 shrink-0 rounded-full', meta.dot, meta.glow)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold text-zinc-500">
                      Q{i + 1}
                    </span>
                    <span className={cn('font-mono text-[9px] tracking-[0.15em]', meta.text)}>
                      {meta.label}
                    </span>
                    {flag && (
                      <span className="rounded-sm bg-red-500/15 px-1.5 font-mono text-[9px] tracking-wide text-red-400">
                        INCONSISTENCY
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-zinc-300">{q.text}</p>
                </div>
              </div>

              <AnimatePresence>
                {fu && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.07] p-2.5">
                      <p className="font-mono text-[9px] font-bold tracking-[0.15em] text-amber-400">
                        ASK NEXT
                      </p>
                      <p className="mt-1 text-[13px] leading-snug text-amber-100/90">{fu.text}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {flag && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-red-500/30 bg-red-500/[0.07] p-2.5">
                      <p className="font-mono text-[9px] font-bold tracking-[0.15em] text-red-400">
                        CONTRADICTS THE {flag.vs.toUpperCase()}
                      </p>
                      <p className="mt-1 text-[13px] leading-snug text-red-100/90">{flag.detail}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

// ---- Center: now speaking + transcript ----

function CallStream({
  transcript,
  playing,
}: {
  transcript: ReturnType<typeof useDiligenceDemo>['transcript'];
  playing: boolean;
}) {
  const latest = transcript[transcript.length - 1];
  const isSubject = latest && latest.speaker === 'researcher';
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Label>Live call</Label>
      <Panel className="p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.15em] text-zinc-500">
            {latest ? (isSubject ? 'RESEARCHER SPEAKING' : 'YOU ASKING') : 'STANDING BY'}
          </span>
          <Waveform active={playing && Boolean(latest)} />
        </div>
        <p className="mt-2 min-h-[3.5rem] text-[15px] leading-relaxed text-zinc-100">
          {latest ? latest.text : 'Press play to start the call.'}
        </p>
      </Panel>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {transcript.slice(0, -1).map((t) => {
          const self = t.speaker === 'analyst';
          const prompted = Boolean(t.prompted_by_copilot);
          return (
            <div key={t.t} className={cn('flex flex-col', self ? 'items-end' : 'items-start')}>
              <div className="mb-0.5 flex items-center gap-1.5 px-1">
                <span className="font-mono text-[9px] tracking-[0.12em] text-zinc-600">
                  {self ? 'YOU' : 'RESEARCHER'}
                </span>
                {prompted && (
                  <span className="font-mono text-[9px] tracking-wide text-amber-400">
                    ◂ COPILOT
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'max-w-[88%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug',
                  self
                    ? 'rounded-br-sm bg-emerald-400/10 text-emerald-50/90'
                    : 'rounded-bl-sm bg-white/[0.04] text-zinc-400'
                )}
              >
                {t.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Right: copilot stream + thesis ----

function CopilotStream({ events }: { events: CopilotEvent[] }) {
  const ordered = [...events].reverse();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Label>Copilot</Label>
      <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {ordered.length === 0 && (
          <p className="text-[12px] text-zinc-600">
            Every lookup, follow-up, and flag streams here as the call runs.
          </p>
        )}
        <AnimatePresence initial={false}>
          {ordered.map((ev) => {
            const c = ACCENT[ev.type];
            return (
              <motion.div
                key={ev.id}
                layout
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 pr-2.5 pl-3"
              >
                <span className={cn('absolute inset-y-0 left-0 w-[3px]', c.bar)} />
                <div className="flex items-center gap-2">
                  <span className={cn('font-mono text-[9px] tracking-[0.14em]', c.text)}>
                    {ev.type.toUpperCase()}
                  </span>
                  {ev.questionId && (
                    <span className="font-mono text-[9px] text-zinc-600">{ev.questionId}</span>
                  )}
                </div>
                {ev.text && (
                  <p className="mt-1 text-[11px] leading-snug text-zinc-400">{ev.text}</p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ThesisPanel({
  cards,
  done,
}: {
  cards: ReturnType<typeof useDiligenceDemo>['thesisDeltas'];
  done: boolean;
}) {
  const final = callFixture.thesis_delta;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Label>Thesis delta</Label>
      <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {cards.length === 0 && (
          <p className="text-[12px] text-zinc-600">
            When an answer moves a modeled assumption, it changes here.
          </p>
        )}
        {done && cards.length > 0 ? (
          <>
            {final.changes.map((c) => (
              <motion.div
                key={c.field}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
              >
                <p className="font-mono text-[9px] tracking-[0.12em] text-zinc-500 uppercase">
                  {c.field}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="text-zinc-500 line-through">{c.from}</span>
                  <ArrowRightIcon className="size-3 text-violet-400" weight="bold" />
                  <span className="font-semibold text-violet-300">{c.to}</span>
                </div>
              </motion.div>
            ))}
            <div className="rounded-lg border border-violet-400/30 bg-violet-400/[0.07] p-2.5">
              <p className="font-mono text-[9px] tracking-[0.14em] text-violet-400">NET</p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-300">{final.net}</p>
            </div>
          </>
        ) : (
          <AnimatePresence initial={false}>
            {cards.map((card) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-lg border border-violet-400/20 bg-violet-400/[0.05] p-2.5"
              >
                <p className="font-mono text-[9px] text-zinc-500">{card.questionId}</p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-300">{card.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ---- Transport ----

function Transport({ state }: { state: ReturnType<typeof useDiligenceDemo> }) {
  const speeds = [
    { label: 'SLOW', ms: 4000 },
    { label: 'NORMAL', ms: 2600 },
    { label: 'FAST', ms: 1400 },
  ];
  return (
    <footer className="flex items-center gap-3 border-t border-white/[0.06] px-5 py-2.5">
      <button
        onClick={state.controls.back}
        disabled={state.cursor === 0}
        className="text-zinc-400 hover:text-white disabled:opacity-30"
        aria-label="Back"
      >
        <CaretLeftIcon weight="bold" className="size-4" />
      </button>
      {state.done ? (
        <button
          onClick={state.controls.restart}
          className="flex size-8 items-center justify-center rounded-full bg-emerald-400 text-black"
          aria-label="Restart"
        >
          <ArrowCounterClockwiseIcon weight="bold" className="size-4" />
        </button>
      ) : (
        <button
          onClick={state.controls.toggle}
          className="flex size-8 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200"
          aria-label={state.playing ? 'Pause' : 'Play'}
        >
          {state.playing ? (
            <PauseIcon weight="fill" className="size-4" />
          ) : (
            <PlayIcon weight="fill" className="size-4" />
          )}
        </button>
      )}
      <button
        onClick={state.controls.step}
        disabled={state.done}
        className="text-zinc-400 hover:text-white disabled:opacity-30"
        aria-label="Step"
      >
        <CaretRightIcon weight="bold" className="size-4" />
      </button>

      <span className="ml-1 font-mono text-[10px] text-zinc-600 tabular-nums">
        {Math.min(state.cursor, state.total)} / {state.total}
      </span>

      <div className="ml-auto flex items-center gap-1">
        {speeds.map((s) => (
          <button
            key={s.label}
            onClick={() => state.controls.setSpeedMs(s.ms)}
            className={cn(
              'rounded px-2 py-1 font-mono text-[9px] tracking-[0.12em] transition-colors',
              state.speedMs === s.ms
                ? 'bg-white/10 text-white'
                : 'text-zinc-600 hover:text-zinc-300'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </footer>
  );
}

// ---- Main ----

export function MissionConsole() {
  const state = useDiligenceDemo(questionsFixture, callFixture);
  const { company } = questionsFixture;
  const { tally } = state;
  const allCovered = state.done && tally.answered === tally.total;

  const { play, restart } = state.controls;
  useEffect(() => {
    play();
  }, [play]);
  useEffect(() => {
    if (!state.done) return;
    const id = setTimeout(() => restart(), 7000);
    return () => clearTimeout(id);
  }, [state.done, restart]);

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-[#0a0b0f] text-zinc-200">
      {/* ambient grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <CommandBar
          ticker={company.ticker}
          company={company.name.replace(', Inc.', '')}
          exchange={company.exchange}
          callKind="Diligence call · sell-side"
          answered={tally.answered}
          partial={tally.partial}
          total={tally.total}
          live={!state.done}
        />

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
          <CoverageRail
            questions={questionsFixture.questions}
            coverage={state.coverage}
            followups={state.activeFollowups}
            flags={state.flags}
            allCovered={allCovered}
          />
          <CallStream transcript={state.transcript} playing={state.playing} />
          <section className="flex min-h-0 flex-col gap-4">
            <CopilotStream events={state.copilotEvents} />
            <ThesisPanel cards={state.thesisDeltas} done={state.done} />
          </section>
        </main>

        <Transport state={state} />
      </div>
    </div>
  );
}
