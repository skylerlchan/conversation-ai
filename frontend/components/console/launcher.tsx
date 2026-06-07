'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRightIcon, MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/shadcn/utils';

interface Hit {
  symbol: string;
  name: string;
  exchange: string;
}

const SUGGESTED = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'AMZN'];

export function Launcher() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as Hit[];
        setHits(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function launch(symbol: string) {
    // The live console connects to the LiveKit room and renders off the agent's
    // packets. The scripted replay (no backend needed) stays at /console.
    router.push(`/console/live?symbol=${encodeURIComponent(symbol)}`);
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#0a0b0f] px-6 text-zinc-200">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="pointer-events-none absolute top-1/4 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-xl"
      >
        <div className="mb-6 flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
          <span className="font-mono text-[11px] font-medium tracking-[0.28em] text-zinc-400 uppercase">
            Diligence Copilot
          </span>
        </div>

        <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-white sm:text-5xl">
          Go in with your questions.
          <br />
          <span className="text-emerald-400">Leave with zero holes.</span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-400">
          A live copilot for buy-side diligence calls. It tracks every question, grounds each answer
          against your model, and won&apos;t let a hole through.
        </p>

        {/* Search */}
        <div ref={boxRef} className="relative mt-8">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 focus-within:border-emerald-400/40">
            <MagnifyingGlassIcon className="size-4 text-zinc-500" weight="bold" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => hits.length && setOpen(true)}
              placeholder="Search a ticker — AAPL, MSFT, any name…"
              className="w-full bg-transparent text-[15px] text-white placeholder:text-zinc-600 focus:outline-none"
            />
            {loading && (
              <span className="size-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
            )}
          </div>

          {open && hits.length > 0 && (
            <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#111317] shadow-2xl">
              {hits.map((h) => (
                <button
                  key={`${h.symbol}-${h.exchange}`}
                  onClick={() => launch(h.symbol)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.04]"
                >
                  <span className="font-mono text-sm font-semibold text-white">{h.symbol}</span>
                  <span className="flex-1 truncate text-[13px] text-zinc-400">{h.name}</span>
                  <span className="font-mono text-[10px] text-zinc-600">{h.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Suggested */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-wide text-zinc-600">TRY</span>
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => launch(s)}
              className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[11px] text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => launch('AAPL')}
          className={cn(
            'mt-8 flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-black',
            'transition-transform hover:scale-[1.01] hover:bg-zinc-100'
          )}
        >
          Launch the diligence call
          <ArrowRightIcon weight="bold" className="size-4" />
        </button>

        <p className="mt-5 font-mono text-[10px] tracking-wide text-zinc-600">
          Demo replays a recorded AAPL diligence call · live data connects at the event
        </p>
      </motion.div>
    </div>
  );
}
