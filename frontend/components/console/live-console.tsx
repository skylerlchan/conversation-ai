'use client';

import { useMemo } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession, useSessionContext } from '@livekit/components-react';
import { MicrophoneIcon, PhoneCallIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { useLiveCoverage } from '@/hooks/useLiveCoverage';
import type { CoverageState, FlagCard, FollowupCard } from '@/lib/demo/types';
import type { SessionQuestion } from '@/lib/session';
import { getSandboxTokenSource } from '@/lib/utils';
import { CommandBar, CoverageBoard, NextStep } from './mission-console';

const GRID_BG = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

export function LiveConsole({ appConfig }: { appConfig: AppConfig }) {
  const tokenSource = useMemo(
    () =>
      typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
        ? getSandboxTokenSource(appConfig)
        : TokenSource.endpoint('/api/token'),
    [appConfig]
  );
  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );
  return (
    <AgentSessionProvider session={session}>
      <Inner />
    </AgentSessionProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-svh flex-col items-center justify-center overflow-hidden bg-[#0a0b0f] px-6 text-zinc-200">
      <div className="pointer-events-none absolute inset-0 opacity-[0.16]" style={GRID_BG} />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="relative text-center">{children}</div>
    </div>
  );
}

function Inner() {
  const { isConnected, start } = useSessionContext();
  const snap = useLiveCoverage();

  if (!isConnected) {
    return (
      <Centered>
        <p className="font-mono text-[11px] tracking-[0.28em] text-zinc-400 uppercase">
          Live diligence call
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          The copilot listens; you run the call.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[13px] text-zinc-400">
          Connect, then speak the researcher&apos;s side (or pipe in the call). The agent
          transcribes, scores every question, and drives the board live.
        </p>
        <button
          onClick={() => start()}
          className="mx-auto mt-7 flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-black hover:bg-zinc-100"
        >
          <PhoneCallIcon weight="fill" className="size-4" />
          Start the live call
        </button>
      </Centered>
    );
  }

  if (!snap || !snap.questions?.length) {
    return (
      <Centered>
        <div className="mx-auto mb-5 size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
        <p className="font-mono text-sm font-semibold tracking-[0.2em] text-white uppercase">
          Connected · listening
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-zinc-400">
          <MicrophoneIcon weight="fill" className="size-3.5 text-emerald-400" />
          Waiting for the first turn of the call…
        </p>
      </Centered>
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
    .filter((c) => c.contradictions.length > 0)
    .map((c) => ({
      id: `fl-${c.id}`,
      questionId: c.id,
      vs: 'note',
      detail: c.contradictions.join(' · '),
      turn: 0,
    }));
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
          company={snap.company}
          exchange=""
          callKind="Live diligence call"
          answered={answered}
          total={cards.length}
          live
        />
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <CoverageBoard
            questions={questions}
            pillarOf={pillarOf}
            coverage={coverage}
            followups={followups}
            flags={flags}
          />
          <section className="flex min-h-0 flex-col gap-4">
            <NextStep
              followup={followups[0]}
              nextMissed={nextMissed ? { id: nextMissed.id, text: nextMissed.question } : undefined}
              pillar={nextMissed?.pillar}
              allCovered={allCovered}
            />
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] px-4 py-3">
              <MicrophoneIcon weight="fill" className="size-4 text-emerald-400" />
              <span className="text-[13px] text-zinc-300">
                The agent is listening to the live call and scoring every turn.
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
