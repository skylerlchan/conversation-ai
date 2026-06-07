'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { MissionConsoleView } from '@/components/console/mission-console';
import { liveModel } from '@/lib/console-model';
import type { CoveragePacket, TranscriptPacket } from '@/lib/live/types';

// One packet on the synced timeline: a coverage snapshot or a transcript turn,
// stamped with the audio time (`at`, seconds) it should surface.
interface TimelinePacket {
  at: number;
  type: 'coverage_update' | 'transcript';
  data: CoveragePacket | TranscriptPacket;
}
interface Timeline {
  audio: string;
  company: string;
  ticker: string;
  packets: TimelinePacket[];
}

const TIMELINE_URL = '/demo/realcall/timeline.json';

/**
 * Pre-call gate. The click both starts the call and unlocks browser audio. No
 * microphone is requested — the call audio is the real earnings-call recording.
 */
function StartGate({ onStart, ticker }: { onStart: () => void; ticker: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#0a0b0f] px-6 text-zinc-200">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        <span className="font-mono text-[11px] font-medium tracking-[0.28em] text-zinc-400 uppercase">
          Diligence Copilot — Real call
        </span>
      </div>
      <h1 className="max-w-xl text-center text-2xl font-semibold tracking-tight text-white">
        A live {ticker} expert call — real audio
      </h1>
      <p className="max-w-md text-center text-[15px] leading-relaxed text-zinc-400">
        Press start to play the real recording. The copilot transcribes it and grades your questions
        on what&apos;s actually said — every point ticks green in real time, and a thin answer gets
        a grounded follow-up.
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
 * The real-call console: plays the actual earnings-call recording and emits a
 * pre-computed timeline of real transcript + real coverage verdicts against the
 * audio clock, so the console shows real transcription streaming and the
 * questions ticking on real engine output. No mic, no LiveKit, no TTS — the
 * processing (Whisper STT + the coverage engine) ran over the real audio; this
 * replays its output in sync. Timeline built by agent-py/src/build_realcall.py.
 */
export function RealCallConsole() {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [started, setStarted] = useState(false);
  const [live, setLive] = useState(false);
  const [coverage, setCoverage] = useState<CoveragePacket | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPacket[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cursor = useRef(0); // index of the next un-emitted packet (timeline is sorted by `at`)

  useEffect(() => {
    fetch(TIMELINE_URL)
      .then((r) => r.json())
      .then(setTimeline)
      .catch(() => setTimeline(null));
  }, []);

  // Emit every packet whose time has arrived. Forward-only (audio plays forward).
  const emitUpTo = useCallback(
    (t: number) => {
      const tl = timeline;
      if (!tl) return;
      let i = cursor.current;
      while (i < tl.packets.length && tl.packets[i].at <= t) {
        const p = tl.packets[i];
        if (p.type === 'coverage_update') {
          setCoverage(p.data as CoveragePacket);
        } else {
          const turn = p.data as TranscriptPacket;
          setTranscript((prev) => (prev.some((x) => x.t === turn.t) ? prev : [...prev, turn]));
        }
        i++;
      }
      cursor.current = i;
    },
    [timeline]
  );

  const onStart = useCallback(async () => {
    setStarted(true);
    setLive(true);
    emitUpTo(0); // surface the initial (all-open) snapshot immediately
    try {
      await audioRef.current?.play();
    } catch {
      /* autoplay blocked — the click should satisfy it; ignore */
    }
  }, [emitUpTo]);

  const model = liveModel({
    coverage,
    transcript,
    groundings: [],
    live,
    callKind: 'Earnings call · real audio',
  });

  return (
    <>
      {timeline && (
        <audio
          ref={audioRef}
          src={timeline.audio}
          preload="auto"
          onTimeUpdate={() => emitUpTo(audioRef.current?.currentTime ?? 0)}
          onEnded={() => setLive(false)}
        />
      )}
      {!started ? (
        <StartGate onStart={onStart} ticker={timeline?.ticker ?? 'AAPL'} />
      ) : (
        <MissionConsoleView model={model} />
      )}
    </>
  );
}
