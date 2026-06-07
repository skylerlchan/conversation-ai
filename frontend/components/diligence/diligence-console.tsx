'use client';

import { useEffect } from 'react';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr';
import { useDiligenceDemo } from '@/hooks/useDiligenceDemo';
import { callFixture, questionsFixture } from '@/lib/demo';
import { cn } from '@/lib/shadcn/utils';
import { CopilotFeed } from './copilot-feed';
import { CoverageList } from './coverage-list';
import { DemoControls } from './demo-controls';
import { ThesisDeltaPanel } from './thesis-delta-panel';
import { TranscriptFeed } from './transcript-feed';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
      {children}
    </h2>
  );
}

export function DiligenceConsole() {
  const state = useDiligenceDemo(questionsFixture, callFixture);
  const { company, counterpart, thesis } = questionsFixture;
  const { tally } = state;
  const allCovered = state.done && tally.answered === tally.total;

  // Kiosk behavior: auto-start the call on load, and loop after a pause on the
  // all-green finish so the demo keeps running on its own.
  const { play, restart } = state.controls;
  useEffect(() => {
    play();
  }, [play]);
  useEffect(() => {
    if (!state.done) return;
    const id = setTimeout(() => restart(), 6000);
    return () => clearTimeout(id);
  }, [state.done, restart]);

  return (
    <div className="bg-background flex h-svh flex-col">
      {/* Header */}
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg leading-none font-bold">{company.name}</h1>
              <span className="text-muted-foreground text-sm font-medium">
                {company.exchange}: {company.ticker}
              </span>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Diligence call · {counterpart.side} · {counterpart.firm}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Chip className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {tally.answered} answered
            </Chip>
            <Chip className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
              {tally.partial} thin
            </Chip>
            <Chip className="bg-zinc-500/15 text-zinc-600 dark:text-zinc-400">
              {tally.unanswered} open
            </Chip>
          </div>

          <div className="w-full">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(tally.answered / tally.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Body: three columns */}
      <div className="min-h-0 flex-1">
        <div className="mx-auto grid h-full max-w-[1400px] grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          {/* Coverage — the hero */}
          <section className="flex min-h-0 flex-col">
            <SectionLabel>Coverage — your {tally.total} questions</SectionLabel>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {allCovered && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircleIcon weight="fill" className="size-4" />
                  All covered — you hung up with zero holes.
                </div>
              )}
              <CoverageList
                questions={questionsFixture.questions}
                coverage={state.coverage}
                activeFollowups={state.activeFollowups}
                flags={state.flags}
              />
            </div>
          </section>

          {/* Live transcript */}
          <section className="flex min-h-0 flex-col">
            <SectionLabel>Live call</SectionLabel>
            <div className="bg-muted/30 min-h-0 flex-1 overflow-y-auto rounded-xl border p-3">
              <TranscriptFeed transcript={state.transcript} />
            </div>
          </section>

          {/* Copilot feed + thesis delta */}
          <section className="flex min-h-0 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <SectionLabel>Copilot</SectionLabel>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <CopilotFeed events={state.copilotEvents} />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <SectionLabel>Thesis delta</SectionLabel>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <ThesisDeltaPanel
                  cards={state.thesisDeltas}
                  finalDelta={callFixture.thesis_delta}
                  done={state.done}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Controls */}
      <footer className="border-t px-4 py-3">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-muted-foreground mb-2 line-clamp-1 text-xs italic">{thesis}</p>
          <DemoControls
            cursor={state.cursor}
            total={state.total}
            playing={state.playing}
            done={state.done}
            speedMs={state.speedMs}
            onToggle={state.controls.toggle}
            onStep={state.controls.step}
            onBack={state.controls.back}
            onRestart={state.controls.restart}
            onSetSpeed={state.controls.setSpeedMs}
          />
        </div>
      </footer>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap tabular-nums',
        className
      )}
    >
      {children}
    </span>
  );
}
