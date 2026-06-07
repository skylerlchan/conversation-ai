'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { MissionConsoleView, type ThesisDelta } from '@/components/console/mission-console';
import { liveModel } from '@/lib/console-model';
import type { CoveragePacket, TranscriptPacket } from '@/lib/live/types';

interface WordData {
  turn: number;
  speaker: string;
  w: string;
}
interface TimelinePacket {
  at: number;
  type: 'word' | 'transcript' | 'coverage_update' | 'thesis_delta';
  data: unknown;
}
interface Timeline {
  audio: string;
  ticker: string;
  company: string;
  minutesLeft: number;
  askAnswer?: string;
  packets: TimelinePacket[];
}

const TIMELINE_URL = '/demo/qa/timeline.json';
// Minimum spacing between revealed words — smooths bursts into a steady, readable
// stream (the transcript reads in real time rather than appearing in chunks).
const WORD_MIN_MS = 95;
// Hold the transcript ~1.7s behind the audio, like real speech-to-text latency.
const TRANSCRIPT_LAG_S = 1.7;

function StartGate({ onStart, ticker }: { onStart: () => void; ticker: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#0a0b0f] px-6 text-zinc-200">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        <span className="font-mono text-[11px] font-medium tracking-[0.28em] text-zinc-400 uppercase">
          Diligence Copilot
        </span>
      </div>
      <h1 className="max-w-xl text-center text-2xl font-semibold tracking-tight text-white">
        A live {ticker} expert call
      </h1>
      <p className="max-w-md text-center text-[15px] leading-relaxed text-zinc-400">
        The analyst&apos;s question comes in on the call. The copilot transcribes it live, checks
        your questions off, and flags what the answer misses.
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

/**
 * The Q&A demo console: plays the real Apple Q2 FY26 Q&A audio (Eric Woodring to
 * Tim Cook) and replays a time-synced timeline against the audio clock. A
 * rAF loop reveals the transcript word-by-word (capped to a steady cadence so it
 * reads in real time), ticks the question board, surfaces the copilot insight and
 * the assumption change. Built by build_qa_timeline.py.
 */
export function QaConsole() {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [started, setStarted] = useState(false);
  const [live, setLive] = useState(false);
  const [coverage, setCoverage] = useState<CoveragePacket | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPacket[]>([]);
  const [liveTurn, setLiveTurn] = useState<{ speaker: string; text: string } | null>(null);
  const [thesisDelta, setThesisDelta] = useState<ThesisDelta | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);

  // Board events (coverage/insight) fire on the audio clock; the transcript
  // (turn commits + words) lags ~1s behind, like real STT.
  const { board, commits, words } = useMemo(() => {
    const ps = timeline?.packets ?? [];
    return {
      board: ps.filter((p) => p.type === 'coverage_update' || p.type === 'thesis_delta'),
      commits: ps.filter((p) => p.type === 'transcript'),
      words: ps.filter((p) => p.type === 'word'),
    };
  }, [timeline]);

  const boardCursor = useRef(0);
  const commitCursor = useRef(0);
  const shown = useRef(0);
  const lastReveal = useRef(0);
  const buf = useRef<{ turn: number; words: string[] }>({ turn: 0, words: [] });

  useEffect(() => {
    fetch(TIMELINE_URL)
      .then((r) => r.json())
      .then(setTimeline)
      .catch(() => setTimeline(null));
  }, []);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      const t = a.currentTime;
      const lagged = t - TRANSCRIPT_LAG_S;
      // Coverage + insight also trail the audio (deliberate, not instant).
      while (boardCursor.current < board.length && board[boardCursor.current].at <= lagged) {
        const p = board[boardCursor.current];
        if (p.type === 'coverage_update') setCoverage(p.data as CoveragePacket);
        else if (p.type === 'thesis_delta') setThesisDelta(p.data as ThesisDelta);
        boardCursor.current++;
      }
      // Transcript lags ~1s: commit a turn to history once its words are all in.
      while (commitCursor.current < commits.length && commits[commitCursor.current].at <= lagged) {
        const turn = commits[commitCursor.current].data as TranscriptPacket;
        setTranscript((prev) => (prev.some((z) => z.t === turn.t) ? prev : [...prev, turn]));
        setLiveTurn(null);
        buf.current = { turn: 0, words: [] };
        commitCursor.current++;
      }
      // Stream words, one per WORD_MIN_MS, held ~1s behind the audio.
      const now = performance.now();
      if (
        shown.current < words.length &&
        words[shown.current].at <= lagged &&
        now - lastReveal.current >= WORD_MIN_MS
      ) {
        const d = words[shown.current].data as WordData;
        if (buf.current.turn !== d.turn) buf.current = { turn: d.turn, words: [] };
        buf.current.words.push(d.w);
        setLiveTurn({ speaker: d.speaker, text: buf.current.words.join(' ') });
        shown.current++;
        lastReveal.current = now;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [board, commits, words]);

  const onStart = useCallback(async () => {
    // Seed the question board immediately so it's visible from t=0; everything
    // else (coverage ticks, insight, transcript) trails the audio.
    if (board.length) setCoverage(board[0].data as CoveragePacket);
    boardCursor.current = board.length ? 1 : 0;
    commitCursor.current = 0;
    shown.current = 0;
    lastReveal.current = 0;
    buf.current = { turn: 0, words: [] };
    setStarted(true);
    setLive(true);
    try {
      await audioRef.current?.play();
    } catch {
      /* autoplay gate — the click should satisfy it; ignore */
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, board]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const model = liveModel({
    coverage,
    transcript,
    groundings: [],
    live,
    callKind: 'Expert call · live',
  });

  return (
    <>
      {timeline && (
        <audio
          ref={audioRef}
          src={timeline.audio}
          preload="auto"
          onEnded={() => {
            setLive(false);
            cancelAnimationFrame(rafRef.current);
          }}
        />
      )}
      {!started ? (
        <StartGate onStart={onStart} ticker={timeline?.ticker ?? 'AAPL'} />
      ) : (
        <MissionConsoleView
          model={model}
          liveTurn={liveTurn}
          thesisDelta={thesisDelta}
          minutesLeft={timeline?.minutesLeft}
          askAnswer={timeline?.askAnswer}
        />
      )}
    </>
  );
}
