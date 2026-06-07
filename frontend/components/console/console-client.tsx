'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import bakedCmg from '@/lib/demo/baked-cmg.json';
import { demoSession } from '@/lib/demo/demo-session';
import type { Session } from '@/lib/session';
import { MissionConsole } from './mission-console';

// Pre-baked, real sessions that render instantly (no live call needed on stage).
// CAVA = curated diligence script; CMG = a real Chipotle earnings-call analysis.
const BAKED: Record<string, Session> = {
  CAVA: demoSession,
  CMG: bakedCmg as unknown as Session,
};

const STEPS = [
  'Pulling the latest earnings transcript…',
  'Loading real analyst consensus…',
  'Scoring coverage of your questions…',
  'Grounding claims and flagging divergence…',
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-svh flex-col items-center justify-center overflow-hidden bg-[#0a0b0f] px-6 text-zinc-200">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="relative w-full max-w-md text-center">{children}</div>
    </div>
  );
}

function Loading({ symbol }: { symbol: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(id);
  }, []);
  return (
    <Shell>
      <div className="mx-auto mb-5 size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
      <p className="font-mono text-sm font-semibold tracking-[0.2em] text-white uppercase">
        Listening to {symbol}
      </p>
      <p className="mt-2 text-[13px] text-zinc-400">{STEPS[step]}</p>
      <p className="mt-6 font-mono text-[10px] tracking-wide text-zinc-600">
        Live analysis of the real call · ~30s
      </p>
    </Shell>
  );
}

function ErrorView({ symbol, message }: { symbol: string; message: string }) {
  return (
    <Shell>
      <WarningIcon weight="fill" className="mx-auto mb-4 size-7 text-amber-400" />
      <p className="font-mono text-sm font-semibold tracking-[0.15em] text-white uppercase">
        Couldn&apos;t analyze {symbol}
      </p>
      <p className="mt-2 text-[13px] text-zinc-400">{message}</p>
      <Link
        href="/console?symbol=CAVA"
        className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-zinc-100"
      >
        Run the CAVA demo instead
      </Link>
    </Shell>
  );
}

export function ConsoleClient() {
  const params = useSearchParams();
  const symbol = (params.get('symbol') || 'CMG').toUpperCase();
  const baked = BAKED[symbol];

  const [session, setSession] = useState<Session | null>(baked ?? null);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (baked) {
      setSession(baked);
      setError(null);
      return;
    }
    const id = ++reqId.current;
    setSession(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });
        const data = (await res.json()) as Session & { error?: string };
        if (id !== reqId.current) return;
        if (!res.ok) {
          setError(data.error || 'Analysis failed.');
        } else if (!data.questions?.length || !data.turns?.length) {
          setError('The model returned an incomplete analysis. Try again.');
        } else {
          setSession(data);
        }
      } catch (e) {
        if (id === reqId.current) setError((e as Error).message);
      }
    })();
  }, [symbol, baked]);

  if (error) return <ErrorView symbol={symbol} message={error} />;
  if (!session) return <Loading symbol={symbol} />;
  return <MissionConsole session={session} />;
}
