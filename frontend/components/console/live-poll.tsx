'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import type { CoverageState, FlagCard, FollowupCard } from '@/lib/demo/types';
import type { SessionQuestion } from '@/lib/session';
import { cn } from '@/lib/shadcn/utils';
import { CommandBar, CoverageBoard, NextStep } from './mission-console';

interface LiveCard {
  id: string;
  question: string;
  pillar: string;
  state: CoverageState;
  facts: string[];
  contradictions: string[];
  followup: string;
}
interface Assumption {
  id: string;
  pillar: string;
  note: string;
  our_view: string;
}
interface LiveSnap {
  company: string;
  ticker: string;
  thesis: string;
  questions: LiveCard[];
  counts: Record<string, number>;
  assumptions?: Assumption[];
  transcript?: string[];
  now_speaking?: string;
}

const GRID_BG = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
      {children}
    </h2>
  );
}

export function LivePoll() {
  const [snap, setSnap] = useState<LiveSnap | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        const d = await r.json();
        if (active && d && Array.isArray(d.questions)) setSnap(d);
      } catch {
        /* keep last */
      }
    };
    tick();
    const id = setInterval(tick, 700);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [snap?.transcript?.length]);

  if (!snap || !snap.questions?.length) {
    return (
      <div className="relative flex h-svh flex-col items-center justify-center overflow-hidden bg-[#0a0b0f] px-6 text-center text-zinc-200">
        <div className="pointer-events-none absolute inset-0 opacity-[0.16]" style={GRID_BG} />
        <div className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="relative">
          <div className="mx-auto mb-5 size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
          <p className="font-mono text-sm font-semibold tracking-[0.2em] text-white uppercase">
            Waiting for the call
          </p>
          <p className="mt-2 max-w-sm text-[13px] text-zinc-400">
            Start the call audio and run the live runner:
          </p>
          <code className="mt-3 inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left font-mono text-[11px] text-zinc-300">
            uv run python demo/run_live_call.py --audio …/cava_earnings_q1_2026.wav
          </code>
        </div>
      </div>
    );
  }

  const cards = snap.questions;
  const questions: SessionQuestion[] = cards.map((c) => ({ id: c.id, text: c.question }));
  const coverage: Record<string, CoverageState> = Object.fromEntries(
    cards.map((c) => [c.id, c.state])
  );
  const pillarOf: Record<string, string> = Object.fromEntries(cards.map((c) => [c.id, c.pillar]));
  const followups: FollowupCard[] = cards
    .filter((c) => c.state === 'partial' && c.followup)
    .map((c) => ({
      id: `fu-${c.id}`,
      questionId: c.id,
      text: c.followup,
      turn: 0,
      resolved: false,
    }));
  const flags: FlagCard[] = cards
    .filter((c) => c.contradictions?.length > 0)
    .map((c) => ({
      id: `fl-${c.id}`,
      questionId: c.id,
      vs: 'model',
      detail: c.contradictions.join(' · '),
      turn: 0,
    }));
  const flaggedIds = new Set(flags.map((f) => f.questionId));
  const answered = cards.filter((c) => c.state === 'answered').length;
  const nextMissed = cards.find((c) => c.state === 'unanswered');
  const allCovered = cards.length > 0 && answered === cards.length;

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-[#0a0b0f] text-zinc-200">
      <div className="pointer-events-none absolute inset-0 opacity-[0.18]" style={GRID_BG} />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <CommandBar
          ticker={snap.ticker}
          company={snap.company.replace(', Inc.', '')}
          exchange=""
          callKind="Live earnings call"
          answered={answered}
          total={cards.length}
          live
        />
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.85fr)_minmax(0,0.8fr)]">
          <CoverageBoard
            questions={questions}
            pillarOf={pillarOf}
            coverage={coverage}
            followups={followups}
            flags={flags}
          />

          {/* center: next step + live transcript */}
          <section className="flex min-h-0 flex-col gap-4">
            <NextStep
              followup={followups[0]}
              nextMissed={nextMissed ? { id: nextMissed.id, text: nextMissed.question } : undefined}
              pillar={nextMissed?.pillar}
              allCovered={allCovered}
            />
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex items-center gap-2">
                <Label>Live call</Label>
                <MicrophoneIcon weight="fill" className="size-3 text-emerald-400" />
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[14px] leading-relaxed text-zinc-100">
                  {snap.now_speaking || '…'}
                </p>
              </div>
              <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {(snap.transcript ?? []).map((t, i) => (
                  <p key={i} className="text-[12px] leading-snug text-zinc-500">
                    {t}
                  </p>
                ))}
                <div ref={endRef} />
              </div>
            </div>
          </section>

          {/* right: the model (assumptions the copilot grounds against) */}
          <section className="flex min-h-0 flex-col">
            <Label>Your model · assumptions</Label>
            <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {(snap.assumptions ?? []).map((a) => {
                const flagged = flaggedIds.has(a.id);
                return (
                  <motion.div
                    key={a.id}
                    animate={flagged ? { scale: [1, 1.02, 1] } : {}}
                    className={cn(
                      'rounded-lg border p-2.5',
                      flagged
                        ? 'border-red-500/40 bg-red-500/[0.07]'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-zinc-600">{a.id}</span>
                      {flagged && (
                        <span className="rounded-sm bg-red-500/15 px-1 font-mono text-[8px] tracking-wide text-red-400">
                          CHALLENGED
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-1 text-[12px] leading-snug',
                        flagged ? 'text-red-100/90' : 'text-zinc-300'
                      )}
                    >
                      {a.note}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
