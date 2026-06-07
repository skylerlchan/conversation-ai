'use client';

import { useEffect, useRef, useState } from 'react';
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
  QuotesIcon,
  WarningIcon,
} from '@phosphor-icons/react/dist/ssr';
import { DiligenceChat } from '@/components/console/diligence-chat';
import { EarningsVideoHotkey } from '@/components/console/earnings-video-player';
import { useDiligenceDemo } from '@/hooks/useDiligenceDemo';
import {
  type ConsoleEvidence,
  type ConsoleFlag,
  type ConsoleFollowup,
  type ConsoleModel,
  type ConsoleQuestion,
  type ConsoleTurn,
  type PillarGroup,
  activePillarId as activePillarIdOf,
  fixtureModel,
  nextMissed as nextMissedOf,
  pillarGroups,
  pillarOf as pillarOfModel,
} from '@/lib/console-model';
import { callFixture, questionsFixture } from '@/lib/demo';
import type { CoverageState } from '@/lib/demo/types';
import { cn } from '@/lib/shadcn/utils';

// Solid, glow-free coverage states. The accent is a hard left-cut on each row;
// no soft shadows or gradients (the console reads as a terminal, not a card UI).
const STATE: Record<
  CoverageState,
  { label: string; dot: string; text: string; bar: string; fill: string }
> = {
  answered: {
    label: 'COVERED',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bar: 'border-emerald-400/70',
    fill: 'bg-emerald-500/[0.06]',
  },
  partial: {
    label: 'THIN',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    bar: 'border-amber-400',
    fill: 'bg-amber-400/[0.07]',
  },
  unanswered: {
    label: 'OPEN',
    dot: 'bg-zinc-600',
    text: 'text-zinc-500',
    bar: 'border-white/15',
    fill: 'bg-white/[0.015]',
  },
};

// ---- Shared panel chrome: a solid block with a hard header bar ----

function Panel({
  title,
  sub,
  right,
  children,
  bodyClassName,
  className,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0d12]',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2">
        <h2 className="font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
          {title}
        </h2>
        {sub && <span className="font-mono text-[10px] tracking-wide text-zinc-600">{sub}</span>}
        {right && <div className="ml-auto flex items-center">{right}</div>}
      </div>
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
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
    <header className="flex items-center gap-4 border-b border-white/10 bg-[#0c0d12] px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          {live && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
          )}
          <span
            className={cn(
              'relative inline-flex size-2.5 rounded-full',
              live ? 'bg-emerald-400' : 'bg-zinc-600'
            )}
          />
        </span>
        <span
          className={cn(
            'font-mono text-[10px] font-semibold tracking-[0.2em]',
            live ? 'text-emerald-400' : 'text-zinc-500'
          )}
        >
          {live ? 'LIVE' : 'ENDED'}
        </span>
      </div>

      <div className="h-5 w-px bg-white/10" />

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold tracking-tight text-white">{ticker}</span>
        <span className="text-sm text-zinc-400">{company}</span>
        <span className="font-mono text-[10px] tracking-wide text-zinc-600">{exchange}</span>
      </div>

      <span className="rounded-sm border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] tracking-wide text-zinc-400">
        {callKind}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono text-[11px] text-emerald-400 tabular-nums">{answered} done</span>
        <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{open} open</span>
        <div className="flex h-2 w-44 overflow-hidden rounded-sm border border-white/10 bg-black/40">
          <motion.div
            className="h-full bg-emerald-400"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
          {answered}/{total}
        </span>
      </div>
    </header>
  );
}

// ---- A single question row ----

function QuestionRow({
  q,
  state,
  followup,
  flag,
  compact = false,
}: {
  q: ConsoleQuestion;
  state: CoverageState;
  followup?: ConsoleFollowup;
  flag?: ConsoleFlag;
  compact?: boolean;
}) {
  const meta = STATE[state];
  const answered = state === 'answered';
  const notes = q.notes ?? [];
  const hasNotes = notes.length > 0;
  const [open, setOpen] = useState(false);

  // Fire a one-shot celebration only on the *transition* into answered (not on
  // every re-render, and not for rows that were already covered on mount).
  const prevState = useRef(state);
  const [justAnswered, setJustAnswered] = useState(false);
  useEffect(() => {
    if (state === 'answered' && prevState.current !== 'answered') {
      setJustAnswered(true);
      const id = setTimeout(() => setJustAnswered(false), 1200);
      prevState.current = state;
      return () => clearTimeout(id);
    }
    prevState.current = state;
  }, [state]);

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden border-l-2 py-2 pr-2.5 pl-2.5 transition-colors duration-500',
        meta.bar,
        meta.fill
      )}
      animate={justAnswered ? { scale: [1, 1.012, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* One-shot emerald shimmer that sweeps left→right the moment a question is covered. */}
      <AnimatePresence>
        {justAnswered && (
          <motion.span
            className="pointer-events-none absolute -inset-x-2 inset-y-0"
            initial={{ x: '-110%' }}
            animate={{ x: '110%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
            style={{
              background:
                'linear-gradient(100deg, transparent 0%, rgba(52,211,153,0.28) 50%, transparent 100%)',
            }}
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-start gap-2.5">
        <AnimatePresence mode="wait" initial={false}>
          {answered ? (
            <motion.span
              key="check"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 17 }}
              className="mt-0.5 shrink-0"
            >
              <CheckIcon weight="bold" className="size-3.5 text-emerald-400" />
            </motion.span>
          ) : (
            <motion.span
              key="dot"
              exit={{ scale: 0 }}
              className={cn('mt-1 size-2 shrink-0 rounded-full', meta.dot)}
            />
          )}
        </AnimatePresence>
        <div className="min-w-0 flex-1">
          {/* Header: click to reveal the question's Moss-sourced notes. */}
          <div
            className={cn('group/q', hasNotes && 'cursor-pointer')}
            onClick={hasNotes ? () => setOpen((o) => !o) : undefined}
            role={hasNotes ? 'button' : undefined}
            aria-expanded={hasNotes ? open : undefined}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-zinc-600">{q.id}</span>
              <span className={cn('font-mono text-[8px] tracking-[0.14em]', meta.text)}>
                {meta.label}
              </span>
              {flag && (
                <span className="rounded-sm bg-red-500/15 px-1 font-mono text-[8px] tracking-wide text-red-400">
                  INCONSISTENCY
                </span>
              )}
              {hasNotes && (
                <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[8px] tracking-[0.14em] text-cyan-400/80">
                  NOTES
                  <CaretRightIcon
                    weight="bold"
                    className={cn('size-2.5 transition-transform', open && 'rotate-90')}
                  />
                </span>
              )}
            </div>
            <p
              className={cn(
                'mt-0.5 text-[12px] leading-snug transition-colors duration-700',
                answered ? 'text-emerald-300' : compact ? 'text-zinc-500' : 'text-zinc-300',
                hasNotes && !answered && 'group-hover/q:text-zinc-100'
              )}
            >
              {q.text}
            </p>
          </div>

          {/* Moss-sourced notes, revealed on click. */}
          <AnimatePresence>
            {hasNotes && open && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="border-l-2 border-cyan-400/60 bg-cyan-400/[0.06] px-2 py-1.5">
                  <p className="font-mono text-[9px] font-bold tracking-[0.15em] text-cyan-300/90">
                    NOTES · MOSS
                  </p>
                  <ul className="mt-1 space-y-1">
                    {notes.map((n, i) => {
                      const dash = n.lastIndexOf(' — ');
                      const fact = dash > 0 ? n.slice(0, dash) : n;
                      const src = dash > 0 ? n.slice(dash + 3) : '';
                      return (
                        <li key={i} className="flex gap-1.5 text-[12px] leading-snug text-zinc-300">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-cyan-400/70" />
                          <span className="min-w-0">
                            {fact}
                            {src && <span className="text-zinc-500"> — {src}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {followup && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="border-l-2 border-amber-400 bg-amber-400/[0.08] px-2 py-1.5">
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
                <div className="border-l-2 border-red-500 bg-red-500/[0.08] px-2 py-1.5">
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
    </motion.div>
  );
}

// ---- One pillar tab in the rail: id, per-question coverage dots, answered tally ----

function PillarTab({
  group,
  selected,
  coverage,
  onSelect,
}: {
  group: PillarGroup;
  selected: boolean;
  coverage: Record<string, CoverageState>;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-2 border-l-2 px-2.5 py-2.5 text-left transition-colors',
        selected
          ? 'border-l-emerald-400 bg-white/[0.05]'
          : 'border-l-transparent hover:bg-white/[0.025]'
      )}
    >
      <span
        className={cn(
          'rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] font-semibold',
          selected ? 'bg-white/10 text-zinc-100' : 'bg-white/[0.06] text-zinc-500'
        )}
      >
        {group.id}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1">
        {group.questions.map((q) => {
          const s = coverage[q.id] ?? 'unanswered';
          return <span key={q.id} className={cn('size-1.5 rounded-full', STATE[s].dot)} />;
        })}
      </div>
      <span
        className={cn(
          'font-mono text-[10px] tabular-nums',
          group.allDone ? 'text-emerald-400' : selected ? 'text-zinc-300' : 'text-zinc-600'
        )}
      >
        {group.counts.answered}/{group.total}
      </span>
    </button>
  );
}

// ---- Coverage board: a thin pillar rail on the left, the selected pillar's
// questions on the right. The active tab auto-follows the pillar that holds the
// next actionable question; a click holds until the active pillar moves on. ----

function CoverageBoard({
  groups,
  activePillarId,
  coverage,
  followups,
  flags,
  model,
}: {
  groups: PillarGroup[];
  activePillarId?: string;
  coverage: Record<string, CoverageState>;
  followups: ConsoleFollowup[];
  flags: ConsoleFlag[];
  /** Passed straight to the embedded chat so it can ground answers in the call. */
  model: ConsoleModel;
}) {
  const fuByQ = new Map(followups.map((f) => [f.questionId, f]));
  const flagByQ = new Map(flags.map((f) => [f.questionId, f]));

  // Auto-follow: when the next actionable question lands in a new pillar, jump
  // to it. A manual click sets `picked` and holds until activePillarId changes.
  const [picked, setPicked] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (activePillarId) setPicked(activePillarId);
  }, [activePillarId]);

  const selectedId = picked ?? activePillarId ?? groups[0]?.id;
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0];

  return (
    <Panel
      title="Thesis coverage"
      sub={`${groups.length} pillars`}
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="flex min-h-0 flex-1">
        <div className="w-[140px] shrink-0 divide-y divide-white/[0.04] overflow-y-auto border-r border-white/[0.08]">
          {groups.map((g) => (
            <PillarTab
              key={g.id}
              group={g}
              selected={g.id === selected?.id}
              coverage={coverage}
              onSelect={() => setPicked(g.id)}
            />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected?.id ?? 'empty'}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
            >
              {selected ? (
                <>
                  <div className="border-b border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
                    <p className="text-[13px] leading-snug font-medium text-zinc-100">
                      {selected.label}
                    </p>
                    {selected.claim && (
                      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                        {selected.claim}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    {selected.questions.map((q) => (
                      <QuestionRow
                        key={q.id}
                        q={q}
                        state={coverage[q.id] ?? 'unanswered'}
                        followup={fuByQ.get(q.id)}
                        flag={flagByQ.get(q.id)}
                        compact={coverage[q.id] === 'answered'}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <p className="text-[12px] text-zinc-600">Waiting for questions…</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <DiligenceChat model={model} />
    </Panel>
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
      ? 'border-amber-400 bg-amber-400/[0.07]'
      : kind === 'done'
        ? 'border-emerald-400 bg-emerald-400/[0.07]'
        : 'border-white/20 bg-white/[0.03]';
  const eyebrowColor =
    kind === 'ask' ? 'text-amber-400' : kind === 'done' ? 'text-emerald-400' : 'text-zinc-400';

  return (
    <Panel title="Next step" className="shrink-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${kind}-${body}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className={cn('m-3 border-l-[3px] p-4', accent)}
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
          <p className="mt-2.5 text-[19px] leading-snug font-medium text-white">{body}</p>
          {sub && <p className="mt-2 font-mono text-[11px] tracking-wide text-zinc-500">{sub}</p>}
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
}

// ---- Context panel: what the analyst's note / corpus says about the live answer ----

/** Split a source's text into clean bullet lines (handles multi-line Moss digests). */
function toBullets(text: string): string[] {
  return text
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/^[-•*]\s+/, '')
        .trim()
    )
    .filter(Boolean);
}

function ContextPanel({ evidence }: { evidence?: ConsoleEvidence }) {
  return (
    <Panel
      title="Context"
      sub="on what they just said"
      right={
        evidence?.questionId ? (
          <span className="rounded-[3px] bg-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
            {evidence.questionId}
          </span>
        ) : undefined
      }
      className="min-h-0 flex-1"
      bodyClassName="overflow-y-auto"
    >
      <AnimatePresence mode="wait">
        {evidence ? (
          <motion.div
            key={String(evidence.turn)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 p-3"
          >
            {/* What the researcher actually said */}
            <div className="border-l-2 border-white/15 bg-white/[0.02] px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <QuotesIcon weight="fill" className="size-3 text-zinc-500" />
                <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-zinc-500">
                  THEY SAID
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-zinc-300">{evidence.claim}</p>
            </div>

            {/* Contradiction with the analyst's model, when present */}
            {evidence.contradiction && (
              <div className="border-l-2 border-red-500 bg-red-500/[0.08] px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <WarningIcon weight="fill" className="size-3 text-red-400" />
                  <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-red-400">
                    CONTRADICTS YOUR {evidence.contradiction.vs.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-red-100/90">
                  {evidence.contradiction.detail}
                </p>
              </div>
            )}

            {/* Grounded note / corpus snippets — a tight bulleted digest with the
                source dimmed inline (the live feed is a multi-line Moss summary). */}
            {evidence.sources.length > 0 && (
              <div>
                <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-zinc-500">
                  YOUR NOTE / FILINGS
                </span>
                <ul className="mt-1.5 space-y-1">
                  {evidence.sources.flatMap((s, si) =>
                    toBullets(s.text).map((line, li) => {
                      const dash = line.lastIndexOf(' — ');
                      const fact = dash > 0 ? line.slice(0, dash) : line;
                      const src = dash > 0 ? line.slice(dash + 3) : s.label;
                      return (
                        <li
                          key={`${si}-${li}`}
                          className="flex gap-1.5 text-[12px] leading-snug text-zinc-300"
                        >
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-400/70" />
                          <span className="min-w-0">
                            {fact}
                            {src && <span className="text-zinc-500"> — {src}</span>}
                          </span>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}

            {/* Facts the engine pulled out of the turn */}
            {evidence.facts.length > 0 && (
              <div>
                <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-zinc-500">
                  EXTRACTED
                </span>
                <ul className="mt-1.5 space-y-1">
                  {evidence.facts.map((f, i) => (
                    <li key={i} className="flex gap-1.5 text-[12px] leading-snug text-zinc-400">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-zinc-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="max-w-[18rem] text-[12px] leading-relaxed text-zinc-600">
              As the expert answers, this surfaces what your note and the filings say about it — and
              flags anything that contradicts your model.
            </p>
          </div>
        )}
      </AnimatePresence>
    </Panel>
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
    <Panel
      title={
        <button onClick={onToggle} className="flex items-center gap-2" aria-expanded={open}>
          <CaretRightIcon
            weight="bold"
            className={cn('size-3 text-zinc-500 transition-transform', open && 'rotate-90')}
          />
          <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
            Live call
          </span>
        </button>
      }
      sub={latest ? (isSubject ? 'expert speaking' : 'you asking') : 'standing by'}
      right={<Waveform active={playing && Boolean(latest)} />}
      className="shrink-0"
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="min-h-0 overflow-hidden"
          >
            <div className="flex min-h-0 flex-col gap-2 p-3">
              <div className="max-h-[8rem] overflow-y-auto border-l-2 border-emerald-400/50 bg-white/[0.02] px-3 py-2">
                <p className="text-[14px] leading-relaxed text-zinc-100">
                  {latest ? latest.text : 'Waiting for the call to start.'}
                </p>
              </div>
              <div className="max-h-[9rem] space-y-2 overflow-y-auto pr-1">
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
                            {self ? 'YOU' : 'EXPERT'}
                          </span>
                          {prompted && (
                            <span className="font-mono text-[9px] tracking-wide text-amber-400">
                              ◂ COPILOT
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            'max-w-[88%] px-3 py-1.5 text-[12px] leading-snug',
                            self
                              ? 'border-r-2 border-emerald-400/50 bg-emerald-400/10 text-emerald-50/90'
                              : 'border-l-2 border-white/15 bg-white/[0.04] text-zinc-400'
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
    </Panel>
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
    <footer className="flex items-center justify-center gap-4 border-t border-white/10 bg-[#0c0d12] px-5 py-2.5">
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
          className="flex size-9 items-center justify-center rounded-sm bg-emerald-400 text-black"
          aria-label="Restart"
        >
          <ArrowCounterClockwiseIcon weight="bold" className="size-4" />
        </button>
      ) : (
        <button
          onClick={t.toggle}
          className="flex size-9 items-center justify-center rounded-sm bg-white text-black hover:bg-zinc-200"
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

  const allCovered =
    model.done && model.tally.answered === model.tally.total && model.tally.total > 0;
  const pillar = pillarOfModel(model);
  const groups = pillarGroups(model);
  const activePillar = activePillarIdOf(model, groups);
  const followup = model.activeFollowups[0];
  const next = nextMissedOf(model);
  const latestEvidence = model.evidence[model.evidence.length - 1];

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-[#0a0b0f] text-zinc-200">
      {/* Faint solid grid — no blur glow, no gradients. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

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

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <CoverageBoard
            groups={groups}
            activePillarId={activePillar}
            coverage={model.coverage}
            followups={model.activeFollowups}
            flags={model.flags}
            model={model}
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
            <ContextPanel evidence={latestEvidence} />
          </section>
        </main>

        {transport && <Transport t={transport} />}
      </div>
    </div>
  );
}

// ---- Fixture container: the scripted AAPL replay (the /console demo) ----

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
    <>
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
      {/* Baked-in earnings audio on a Spacebar hotkey. Replay = play out loud only. */}
      <EarningsVideoHotkey />
    </>
  );
}
