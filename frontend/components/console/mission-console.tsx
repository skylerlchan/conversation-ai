'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react/dist/ssr';
import { useCallAudio } from '@/hooks/useCallAudio';
import { useDiligenceDemo } from '@/hooks/useDiligenceDemo';
import {
  type ConsoleFollowup,
  type ConsoleModel,
  type ConsoleQuestion,
  type ConsoleTurn,
  type PillarGroup,
  fixtureModel,
  nextMissed as nextMissedOf,
  pillarGroups,
} from '@/lib/console-model';
import { callFixture, questionsFixture } from '@/lib/demo';
import type { CoverageState } from '@/lib/demo/types';
import { cn } from '@/lib/shadcn/utils';

// Per-state styling for the question list. Clean: a dot/check + a small label,
// no per-row boxes.
const STATE: Record<CoverageState, { label: string; text: string }> = {
  answered: { label: 'COVERED', text: 'text-emerald-400' },
  partial: { label: 'THIN', text: 'text-amber-400' },
  unanswered: { label: 'OPEN', text: 'text-zinc-600' },
};

// ---- Section: a light, borderless block — a small label over its content. The
// console gets its structure from labels + spacing + one column divider, not from
// boxes nested in boxes. ----

function Section({
  label,
  sub,
  right,
  children,
  bodyClassName,
  className,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section className={cn('flex min-h-0 flex-col', className)}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-mono text-[10px] font-semibold tracking-[0.22em] text-zinc-500 uppercase">
          {label}
        </h2>
        {sub && <span className="font-mono text-[10px] tracking-wide text-zinc-600">{sub}</span>}
        {right && <div className="ml-auto flex items-center">{right}</div>}
      </div>
      <div className={cn('min-h-0', bodyClassName)}>{children}</div>
    </section>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.95, 0.65, 0.45, 0.8, 0.55];
  return (
    <div className="flex h-4 items-center gap-[3px]">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] bg-emerald-400/80"
          animate={active ? { scaleY: [h, h * 0.3, h] } : { scaleY: 0.2 }}
          transition={
            active
              ? { duration: 0.7 + (i % 4) * 0.18, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.3 }
          }
          style={{ height: `${h * 16}px`, originY: 0.5 }}
        />
      ))}
    </div>
  );
}

// ---- Command bar ----

// A quiet ticking clock — a paid call is a one-shot, so the time left is the stakes.
function CallClock({ live, minutesLeft }: { live: boolean; minutesLeft?: number }) {
  const start = (minutesLeft ?? 52) * 60;
  const [s, setS] = useState(start);
  useEffect(() => setS(start), [start]);
  useEffect(() => {
    if (!live) return;
    const floor = Math.max(30, start - 6 * 60);
    const id = setInterval(() => setS((v) => Math.max(floor, v - 3)), 1000);
    return () => clearInterval(id);
  }, [live, start]);
  const m = Math.floor(s / 60);
  const x = s % 60;
  const warn = live && s <= Math.max(60, start * 0.7);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[9px] tracking-[0.18em] text-zinc-600 uppercase">
        {live ? 'left' : 'ended'}
      </span>
      <span
        className={cn(
          'font-mono text-[15px] font-bold tabular-nums',
          !live ? 'text-zinc-500' : warn ? 'text-amber-400' : 'text-white'
        )}
      >
        {m}:{String(x).padStart(2, '0')}
      </span>
    </div>
  );
}

function CommandBar({
  ticker,
  answered,
  total,
  live,
  minutesLeft,
}: {
  ticker: string;
  answered: number;
  total: number;
  live: boolean;
  minutesLeft?: number;
}) {
  const pct = total > 0 ? (answered / total) * 100 : 0;
  return (
    <header className="flex items-center justify-between border-b border-white/[0.08] px-6 py-3.5">
      <span className="font-mono text-[13px] font-semibold tracking-[0.08em] text-zinc-300">
        {ticker}
      </span>
      <div className="flex items-center gap-6">
        <CallClock live={live} minutesLeft={minutesLeft} />
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] tracking-wide text-zinc-400 tabular-nums">
            <span className="text-emerald-400">{answered}</span>/{total} answered
          </span>
          <div className="flex h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-emerald-400"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

// ---- A single question row: status mark + concise text + state label ----

function QuestionRow({ q, state }: { q: ConsoleQuestion; state: CoverageState }) {
  const covered = state === 'answered';
  const thin = state === 'partial';
  const meta = STATE[state];
  const answer = covered ? (q.facts ?? []).filter(Boolean).join('. ') : '';
  return (
    <div
      className={cn(
        'relative rounded-md py-1.5 pr-2.5 pl-2.5 transition-colors',
        thin && 'bg-amber-400/[0.06]'
      )}
    >
      {thin && (
        <span className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-full bg-amber-400" />
      )}
      {covered && (
        <motion.span
          key="cover-flash"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 rounded-md bg-emerald-400"
        />
      )}
      <div className="relative flex items-center gap-2.5">
        <span className="shrink-0">
          {covered ? (
            <motion.span
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="block"
            >
              <CheckIcon weight="bold" className="size-3.5 text-emerald-400" />
            </motion.span>
          ) : (
            <span
              className={cn(
                'block size-[7px] rounded-full',
                thin ? 'bg-amber-400' : 'border border-zinc-600'
              )}
            />
          )}
        </span>
        <span className="relative min-w-0 flex-1">
          <span
            className={cn(
              'text-[13px] leading-snug',
              covered ? 'text-zinc-400' : thin ? 'font-medium text-white' : 'text-zinc-400'
            )}
          >
            {q.text}
          </span>
          {/* A bold line drawn across the question the moment it's covered. */}
          {covered && (
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ originX: 0 }}
              className="pointer-events-none absolute top-1/2 left-0 h-[2.5px] w-full -translate-y-1/2 rounded-full bg-emerald-400"
            />
          )}
        </span>
        <span className={cn('shrink-0 font-mono text-[8px] tracking-[0.16em]', meta.text)}>
          {meta.label}
        </span>
      </div>

      {/* Once crossed out: the answer drops in, then the agent writes it to the model. */}
      {covered && answer && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
          className="overflow-hidden pl-[26px]"
        >
          <p className="mt-1.5 text-[12px] leading-snug text-zinc-300">{answer}</p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.4 }}
            className="mt-1.5 flex items-center gap-1.5"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="font-mono text-[9px] tracking-[0.16em] text-emerald-400/80 uppercase">
              Updating model
            </span>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

// ---- A pillar group: a light label over its questions (no box) ----

function PillarGroupView({
  group,
  coverage,
}: {
  group: PillarGroup;
  coverage: Record<string, CoverageState>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2.5 pb-1.5">
        <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-zinc-500 uppercase">
          {group.label}
        </span>
        <span
          className={cn(
            'ml-auto font-mono text-[10px] tabular-nums',
            group.allDone ? 'text-emerald-400' : 'text-zinc-600'
          )}
        >
          {group.counts.answered}/{group.total}
        </span>
      </div>
      <div className="space-y-0.5">
        {group.questions.map((q) => (
          <QuestionRow key={q.id} q={q} state={coverage[q.id] ?? 'unanswered'} />
        ))}
      </div>
    </div>
  );
}

// ---- Coverage board: questions grouped by pillar ----

function CoverageBoard({
  groups,
  coverage,
}: {
  groups: PillarGroup[];
  coverage: Record<string, CoverageState>;
}) {
  return (
    <Section
      label="Questions"
      className="h-full"
      bodyClassName="flex-1 space-y-5 overflow-y-auto pr-1"
    >
      {groups.map((g) => (
        <PillarGroupView key={g.id} group={g} coverage={coverage} />
      ))}
    </Section>
  );
}

// ---- Copilot insight: the hero. The single most important thing on screen. ----

function CopilotInsight({
  followup,
  nextMissed,
  allCovered,
}: {
  followup?: ConsoleFollowup;
  nextMissed?: ConsoleQuestion;
  allCovered: boolean;
}) {
  let tone: 'gap' | 'done' | 'idle';
  let body: string;
  let sub: string | undefined;
  if (allCovered) {
    tone = 'done';
    body = 'All questions covered. Hang up with zero holes.';
  } else if (followup) {
    tone = 'gap';
    body = followup.text;
    sub = `on ${followup.questionId}`;
  } else if (nextMissed) {
    tone = 'idle';
    body = `Still open: ${nextMissed.text}`;
  } else {
    tone = 'idle';
    body = 'Listening to the call.';
  }

  const ring =
    tone === 'gap'
      ? 'ring-amber-400/40'
      : tone === 'done'
        ? 'ring-emerald-400/40'
        : 'ring-white/10';
  const dot = tone === 'gap' ? 'bg-amber-400' : tone === 'done' ? 'bg-emerald-400' : 'bg-zinc-500';
  const labelColor =
    tone === 'gap' ? 'text-amber-400' : tone === 'done' ? 'text-emerald-400' : 'text-zinc-400';

  return (
    <div className={cn('shrink-0 rounded-xl bg-white/[0.035] p-4 ring-1', ring)}>
      <div className="flex items-center gap-2">
        <span className={cn('size-1.5 rounded-full', dot, tone === 'gap' && 'animate-pulse')} />
        <span
          className={cn('font-mono text-[10px] font-bold tracking-[0.24em] uppercase', labelColor)}
        >
          Copilot insight
        </span>
        {sub && <span className="ml-auto font-mono text-[10px] text-zinc-500">{sub}</span>}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={body}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mt-2.5 text-[18px] leading-snug font-medium text-white"
        >
          {body}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---- Live call: the transcript, streaming. Clean text, no chat bubbles. ----

function LiveCall({
  transcript,
  playing,
  liveTurn,
}: {
  transcript: ConsoleTurn[];
  playing: boolean;
  liveTurn?: { speaker: string; text: string } | null;
}) {
  const streaming = Boolean(liveTurn?.text);
  const current = streaming ? liveTurn! : transcript[transcript.length - 1];
  const history = streaming ? transcript.slice() : transcript.slice(0, -1);
  const speaker = (s: string) => (s === 'analyst' ? 'YOU' : 'EXPERT');
  return (
    <Section
      label="Live call"
      right={<Waveform active={streaming || (playing && Boolean(current))} />}
      className="min-h-0 flex-1"
      bodyClassName="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
    >
      {current ? (
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-[9px] tracking-[0.16em] text-zinc-500">
              {speaker(current.speaker)}
            </span>
            {streaming && (
              <span className="flex items-center gap-1 font-mono text-[9px] text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                transcribing
              </span>
            )}
          </div>
          <p className="text-[15px] leading-relaxed text-zinc-100">{current.text}</p>
        </div>
      ) : (
        <p className="text-[13px] text-zinc-600">Waiting for the call to start.</p>
      )}
      {history.reverse().map((t) => (
        <div key={t.t} className="border-t border-white/[0.06] pt-2.5">
          <span className="font-mono text-[9px] tracking-[0.16em] text-zinc-600">
            {speaker(t.speaker)}
          </span>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">{t.text}</p>
        </div>
      ))}
    </Section>
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
    <footer className="flex items-center justify-center gap-4 border-t border-white/[0.08] px-5 py-2.5">
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

// ---- Assumption changed: the thesis delta, compact, at the bottom ----

export interface ThesisDelta {
  questionId: string;
  field: string;
  from: string;
  to: string;
  means: string;
}

// ---- Ask bar: ask the copilot about the call (Granola-style) ----

function AskBar({ answer }: { answer?: string }) {
  const [q, setQ] = useState('');
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const a =
    answer ??
    'The copilot is tracking the call. Ask about any question and it answers from the transcript.';
  const submit = () => {
    const text = q.trim();
    if (!text) return;
    setThread((prev) => [...prev, { q: text, a }]);
    setQ('');
  };
  return (
    <div className="shrink-0">
      {thread.length > 0 && (
        <div className="mb-2 max-h-32 space-y-2 overflow-y-auto">
          {thread.map((m, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2">
              <p className="text-[12px] font-medium text-zinc-200">{m.q}</p>
              <p className="mt-1 text-[12px] leading-snug text-zinc-400">{m.a}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3.5 py-2.5 ring-1 ring-white/10 focus-within:ring-white/20">
        <MagnifyingGlassIcon weight="bold" className="size-3.5 shrink-0 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask anything about the call"
          className="w-full bg-transparent text-[13px] text-white placeholder:text-zinc-600 focus:outline-none"
        />
        <button
          onClick={submit}
          aria-label="Ask"
          className="shrink-0 text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowRightIcon weight="bold" className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ---- Presentational console: one UI, driven by a ConsoleModel ----

export function MissionConsoleView({
  model,
  transport,
  liveTurn,
  minutesLeft,
  askAnswer,
}: {
  model: ConsoleModel;
  /** When present, renders the replay transport (fixture mode). */
  transport?: TransportControls;
  /** In-progress utterance from live STT, shown streaming in the Live call panel. */
  liveTurn?: { speaker: string; text: string } | null;
  /** When present, an answer flipped a modeled assumption — shown at the bottom. */
  thesisDelta?: ThesisDelta | null;
  /** Starting minutes on the call clock (time-pressure framing). */
  minutesLeft?: number;
  /** Canned answer for the ask bar (demo). */
  askAnswer?: string;
}) {
  const allCovered =
    model.done && model.tally.answered === model.tally.total && model.tally.total > 0;
  const groups = pillarGroups(model);
  const followup = model.activeFollowups[0];
  const next = nextMissedOf(model);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[#0a0b0f] text-zinc-200">
      <CommandBar
        ticker={model.company.ticker}
        answered={model.tally.answered}
        total={model.tally.total}
        live={model.live}
        minutesLeft={minutesLeft}
      />

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.78fr)_1px_minmax(0,1.22fr)]">
        <div className="min-h-0 overflow-hidden p-6">
          <CoverageBoard groups={groups} coverage={model.coverage} />
        </div>

        <div className="hidden bg-white/[0.06] lg:block" />

        <div className="flex min-h-0 flex-col gap-4 p-6">
          <CopilotInsight followup={followup} nextMissed={next} allCovered={allCovered} />
          <LiveCall transcript={model.transcript} playing={model.playing} liveTurn={liveTurn} />
          <AskBar answer={askAnswer} />
        </div>
      </main>

      {transport && <Transport t={transport} />}
    </div>
  );
}

// ---- Pre-call gate: a click both starts the call and unlocks browser audio ----

function StartGate({ onStart, ticker }: { onStart: () => void; ticker: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#0a0b0f] px-6 text-zinc-200">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        <span className="font-mono text-[11px] font-medium tracking-[0.28em] text-zinc-400 uppercase">
          Diligence Copilot
        </span>
      </div>
      <h1 className="max-w-lg text-center text-2xl font-semibold tracking-tight text-white">
        A live {ticker} diligence call
      </h1>
      <p className="max-w-sm text-center text-[15px] leading-relaxed text-zinc-400">
        Coverage ticks green as answers land. The copilot flags the moment one comes back thin.
      </p>
      <button
        onClick={onStart}
        className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-black transition-transform hover:scale-[1.01] hover:bg-zinc-100"
      >
        Start call
        <ArrowRightIcon weight="bold" className="size-4" />
      </button>
    </div>
  );
}

// ---- Fixture container: the scripted AAPL replay (the /console demo) ----

// Per-turn clips written by agent-py/demo/gen_demo_audio.py, served from /public.
const clipForTurn = (t: number) => `/demo/audio/turn_${String(t).padStart(2, '0')}.mp3`;

export function MissionConsole() {
  const [started, setStarted] = useState(false);
  // Audio (per-turn clip ending) is the clock, so disable the internal timer.
  const state = useDiligenceDemo(questionsFixture, callFixture, { externalClock: true });
  const model = fixtureModel(state, questionsFixture);

  const { play, restart, step } = state.controls;

  // The clip for the turn currently being spoken (the one about to be revealed).
  const turns = callFixture.turns;
  const current = state.cursor < turns.length ? turns[state.cursor] : null;
  const src = started && current ? clipForTurn(current.t) : null;

  // When the current turn's audio finishes, reveal it and tick coverage.
  useCallAudio({ src, playing: state.playing, onEnded: step });

  // Loop the demo: 7s after the close, restart from the top (audio stays unlocked).
  useEffect(() => {
    if (!state.done) return;
    const id = setTimeout(() => restart(), 7000);
    return () => clearTimeout(id);
  }, [state.done, restart]);

  const onStart = useCallback(() => {
    setStarted(true);
    play();
  }, [play]);

  if (!started) {
    return <StartGate onStart={onStart} ticker={model.company.ticker} />;
  }

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
