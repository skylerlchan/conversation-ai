'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react/dist/ssr';
import {
  type ConsoleFlag,
  type ConsoleFollowup,
  type ConsoleModel,
  type ConsoleQuestion,
  type ConsoleTurn,
  fixtureModel,
  nextMissed as nextMissedOf,
  pillarOf as pillarOfModel,
} from '@/lib/console-model';
import { callFixture, questionsFixture } from '@/lib/demo';
import type { CoverageState } from '@/lib/demo/types';
import { useDiligenceDemo } from '@/hooks/useDiligenceDemo';
import { cn } from '@/lib/shadcn/utils';

const STATE: Record<CoverageState, { label: string; dot: string; glow: string; text: string }> = {
  answered: {
    label: 'COVERED',
    dot: 'bg-emerald-400',
    glow: 'shadow-[0_0_10px_1px_rgba(52,211,153,0.5)]',
    text: 'text-emerald-400',
  },
  partial: {
    label: 'THIN',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_10px_1px_rgba(251,191,36,0.6)]',
    text: 'text-amber-400',
  },
  unanswered: { label: 'OPEN', dot: 'bg-zinc-600', glow: '', text: 'text-zinc-500' },
};

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
  total,
  live,
}: {
  ticker: string;
  company: string;
  exchange: string;
  callKind: string;
  answered: number;
  total: number;
  live: boolean;
}) {
  const open = total - answered;
  const pct = total > 0 ? (answered / total) * 100 : 0;
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
        <span className="font-mono text-[11px] text-emerald-400 tabular-nums">{answered} done</span>
        <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{open} missed</span>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </header>
  );
}

// ---- A single question row ----

function QuestionRow({
  q,
  state,
  pillar,
  followup,
  flag,
  compact = false,
}: {
  q: ConsoleQuestion;
  state: CoverageState;
  pillar?: string;
  followup?: ConsoleFollowup;
  flag?: ConsoleFlag;
  compact?: boolean;
}) {
  const meta = STATE[state];
  return (
    <div
      className={cn(
        'rounded-lg border p-2.5',
        state === 'partial'
          ? 'border-amber-400/30 bg-amber-400/[0.05]'
          : state === 'answered'
            ? 'border-white/[0.05] bg-white/[0.01]'
            : 'border-white/[0.07] bg-white/[0.02]'
      )}
    >
      <div className="flex items-start gap-2.5">
        {state === 'answered' ? (
          <CheckIcon weight="bold" className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
        ) : (
          <span className={cn('mt-1 size-2 shrink-0 rounded-full', meta.dot, meta.glow)} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-zinc-600">{q.id}</span>
            {pillar && (
              <span className="truncate font-mono text-[9px] text-zinc-600">· {pillar}</span>
            )}
            {flag && (
              <span className="rounded-sm bg-red-500/15 px-1 font-mono text-[8px] tracking-wide text-red-400">
                INCONSISTENCY
              </span>
            )}
          </div>
          <p
            className={cn(
              'mt-0.5 leading-snug',
              compact ? 'text-[12px] text-zinc-500' : 'text-[12px] text-zinc-300'
            )}
          >
            {q.text}
          </p>

          <AnimatePresence>
            {followup && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-md border border-amber-400/30 bg-amber-400/[0.08] p-2">
                  <p className="font-mono text-[9px] font-bold tracking-[0.15em] text-amber-400">
                    ASK NEXT
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-amber-100/90">{followup.text}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {flag && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-md border border-red-500/30 bg-red-500/[0.08] p-2">
                  <p className="font-mono text-[9px] font-bold tracking-[0.15em] text-red-400">
                    CONTRADICTS THE {flag.vs.toUpperCase()}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-red-100/90">{flag.detail}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---- Coverage board: missed (top) + completed (bottom) ----

function CoverageBoard({
  questions,
  pillarOf,
  coverage,
  followups,
  flags,
}: {
  questions: ConsoleQuestion[];
  pillarOf: Record<string, string>;
  coverage: Record<string, CoverageState>;
  followups: ConsoleFollowup[];
  flags: ConsoleFlag[];
}) {
  const fuByQ = new Map(followups.map((f) => [f.questionId, f]));
  const flagByQ = new Map(flags.map((f) => [f.questionId, f]));

  const missed = questions
    .filter((q) => (coverage[q.id] ?? 'unanswered') !== 'answered')
    // thin (needs a follow-up) above not-yet-asked
    .sort((a, b) => Number(coverage[b.id] === 'partial') - Number(coverage[a.id] === 'partial'));
  const completed = questions.filter((q) => coverage[q.id] === 'answered');

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Label>Missed</Label>
          <span className="font-mono text-[10px] text-zinc-600">{missed.length}</span>
        </div>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {missed.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] p-2.5 text-[12px] font-medium text-emerald-300">
              <CheckCircleIcon weight="fill" className="size-4" /> Nothing missed — zero holes.
            </div>
          ) : (
            missed.map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                state={coverage[q.id] ?? 'unanswered'}
                pillar={pillarOf[q.id]}
                followup={fuByQ.get(q.id)}
                flag={flagByQ.get(q.id)}
              />
            ))
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Label>Completed</Label>
          <span className="font-mono text-[10px] text-emerald-400">{completed.length}</span>
        </div>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {completed.length === 0 ? (
            <p className="text-[12px] text-zinc-600">Answered questions land here.</p>
          ) : (
            completed.map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                state="answered"
                pillar={pillarOf[q.id]}
                flag={flagByQ.get(q.id)}
                compact
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ---- The single next actionable step (center focus) ----

function NextStep({
  followup,
  nextMissed,
  pillar,
  allCovered,
}: {
  followup?: ConsoleFollowup;
  nextMissed?: ConsoleQuestion;
  pillar?: string;
  allCovered: boolean;
}) {
  let kind: 'done' | 'ask' | 'cover';
  let eyebrow: string;
  let body: string;
  let sub: string | undefined;

  if (allCovered) {
    kind = 'done';
    eyebrow = 'All covered';
    body = 'Every question answered. You can hang up with zero holes.';
  } else if (followup) {
    kind = 'ask';
    eyebrow = 'Ask now';
    body = followup.text;
    sub = `Closes ${followup.questionId}`;
  } else if (nextMissed) {
    kind = 'cover';
    eyebrow = 'Cover next';
    body = nextMissed.text;
    sub = pillar;
  } else {
    kind = 'done';
    eyebrow = 'Listening';
    body = 'Tracking the call.';
  }

  const accent =
    kind === 'ask'
      ? 'border-amber-400/40 bg-amber-400/[0.06]'
      : kind === 'done'
        ? 'border-emerald-400/40 bg-emerald-400/[0.06]'
        : 'border-white/10 bg-white/[0.03]';
  const eyebrowColor =
    kind === 'ask' ? 'text-amber-400' : kind === 'done' ? 'text-emerald-400' : 'text-zinc-400';

  return (
    <div>
      <Label>Next step</Label>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${kind}-${body}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className={cn('mt-2 rounded-2xl border p-5', accent)}
        >
          <div className="flex items-center gap-2">
            {kind === 'done' ? (
              <CheckCircleIcon weight="fill" className="size-4 text-emerald-400" />
            ) : (
              <ArrowRightIcon weight="bold" className={cn('size-4', eyebrowColor)} />
            )}
            <span
              className={cn(
                'font-mono text-[11px] font-bold tracking-[0.2em] uppercase',
                eyebrowColor
              )}
            >
              {eyebrow}
            </span>
          </div>
          <p className="mt-3 text-[20px] leading-snug font-medium text-white">{body}</p>
          {sub && <p className="mt-2 font-mono text-[11px] tracking-wide text-zinc-500">{sub}</p>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---- Retractable live call ----

function LiveCall({
  transcript,
  playing,
  open,
  onToggle,
}: {
  transcript: ConsoleTurn[];
  playing: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const latest = transcript[transcript.length - 1];
  const isSubject = latest && latest.speaker === 'researcher';
  return (
    <div className="flex min-h-0 flex-col">
      <button
        onClick={onToggle}
        className="flex items-center gap-2.5 py-1 text-left"
        aria-expanded={open}
      >
        <CaretRightIcon
          weight="bold"
          className={cn('size-3 text-zinc-500 transition-transform', open && 'rotate-90')}
        />
        <Label>Live call</Label>
        <span className="font-mono text-[10px] text-zinc-600">
          {latest ? (isSubject ? 'researcher speaking' : 'you asking') : 'standing by'}
        </span>
        <span className="ml-1">
          <Waveform active={playing && Boolean(latest)} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="min-h-0 overflow-hidden"
          >
            <div className="mt-2 flex min-h-0 flex-col gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[15px] leading-relaxed text-zinc-100">
                  {latest ? latest.text : 'Waiting for the call to start.'}
                </p>
              </div>
              <div className="max-h-[34vh] space-y-2 overflow-y-auto pr-1">
                {transcript
                  .slice(0, -1)
                  .reverse()
                  .map((t) => {
                    const self = t.speaker === 'analyst';
                    const prompted = Boolean(t.prompted_by_copilot);
                    return (
                      <div
                        key={t.t}
                        className={cn('flex flex-col', self ? 'items-end' : 'items-start')}
                      >
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
                            'max-w-[88%] rounded-2xl px-3 py-1.5 text-[12px] leading-snug',
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Transport (fixture replay only) ----

export interface TransportControls {
  cursor: number;
  playing: boolean;
  done: boolean;
  back: () => void;
  toggle: () => void;
  step: () => void;
  restart: () => void;
}

function Transport({ t }: { t: TransportControls }) {
  return (
    <footer className="flex items-center justify-center gap-4 border-t border-white/[0.06] px-5 py-2.5">
      <button
        onClick={t.back}
        disabled={t.cursor === 0}
        className="text-zinc-400 hover:text-white disabled:opacity-30"
        aria-label="Back"
      >
        <CaretLeftIcon weight="bold" className="size-4" />
      </button>
      {t.done ? (
        <button
          onClick={t.restart}
          className="flex size-9 items-center justify-center rounded-full bg-emerald-400 text-black"
          aria-label="Restart"
        >
          <ArrowCounterClockwiseIcon weight="bold" className="size-4" />
        </button>
      ) : (
        <button
          onClick={t.toggle}
          className="flex size-9 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200"
          aria-label={t.playing ? 'Pause' : 'Play'}
        >
          {t.playing ? (
            <PauseIcon weight="fill" className="size-4" />
          ) : (
            <PlayIcon weight="fill" className="size-4" />
          )}
        </button>
      )}
      <button
        onClick={t.step}
        disabled={t.done}
        className="text-zinc-400 hover:text-white disabled:opacity-30"
        aria-label="Step"
      >
        <CaretRightIcon weight="bold" className="size-4" />
      </button>
    </footer>
  );
}

// ---- Presentational console: one UI, driven by a ConsoleModel ----

export function MissionConsoleView({
  model,
  transport,
}: {
  model: ConsoleModel;
  /** When present, renders the replay transport (fixture mode). */
  transport?: TransportControls;
}) {
  const [callOpen, setCallOpen] = useState(true);

  const allCovered = model.done && model.tally.answered === model.tally.total && model.tally.total > 0;
  const pillar = pillarOfModel(model);
  const followup = model.activeFollowups[0];
  const next = nextMissedOf(model);

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-[#0a0b0f] text-zinc-200">
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
          ticker={model.company.ticker}
          company={model.company.name}
          exchange={model.company.exchange}
          callKind={model.callKind}
          answered={model.tally.answered}
          total={model.tally.total}
          live={model.live}
        />

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <CoverageBoard
            questions={model.questions}
            pillarOf={pillar}
            coverage={model.coverage}
            followups={model.activeFollowups}
            flags={model.flags}
          />

          <section className="flex min-h-0 flex-col gap-4">
            <NextStep
              followup={followup}
              nextMissed={next}
              pillar={next ? pillar[next.id] : undefined}
              allCovered={allCovered}
            />
            <LiveCall
              transcript={model.transcript}
              playing={model.playing}
              open={callOpen}
              onToggle={() => setCallOpen((o) => !o)}
            />
          </section>
        </main>

        {transport && <Transport t={transport} />}
      </div>
    </div>
  );
}

// ---- Fixture container: the scripted CAVA/CMG replay (the /console demo) ----

export function MissionConsole() {
  const state = useDiligenceDemo(questionsFixture, callFixture);
  const model = fixtureModel(state, questionsFixture);

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
    <MissionConsoleView
      model={model}
      transport={{
        cursor: state.cursor,
        playing: state.playing,
        done: state.done,
        back: state.controls.back,
        toggle: state.controls.toggle,
        step: state.controls.step,
        restart: state.controls.restart,
      }}
    />
  );
}
