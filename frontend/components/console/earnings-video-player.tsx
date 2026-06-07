'use client';

import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { CaretDownIcon, CaretUpIcon, PlayIcon } from '@phosphor-icons/react/dist/ssr';

// Baked-in demo asset (see frontend/public). The supercut of all 16 analyst
// questions from the Apple Q2 FY26 call, cut and concatenated, with audio.
const SRC = '/apple-earnings-questions.mp4';
const LABEL = 'AAPL Q2 FY26 — analyst questions';
// Hardcoded trigger. Spacebar toggles play/pause.
const HOTKEY = ' ';

function clock(s: number): string {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** True when a keystroke is meant for a text field, not our hotkey. */
function typingInField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/**
 * A baked-in earnings-call player: a small side widget wired to a hardcoded hotkey
 * (Spacebar). Pressing the key plays the question supercut; pressing it again pauses.
 *
 * `onPlayStart` (live console only) fires the first time playback begins and hands
 * the parent the <video> element, so it can `captureStream()` the audio and route it
 * into the LiveKit room — the agent then hears the call live. On the replay console
 * there's no handler, so it just plays out loud.
 */
export function EarningsVideoHotkey({
  onPlayStart,
  routedHint,
  playRef,
}: {
  onPlayStart?: (video: HTMLVideoElement) => void;
  routedHint?: string;
  /** Populated with a play() fn so a parent can start playback (e.g. the live
   * console's one-click gate, which must start the video within its click gesture). */
  playRef?: MutableRefObject<(() => void) | null>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      void v.play();
    } else {
      v.pause();
    }
  }, []);

  // Global hotkey. Ignores modifier combos, key-repeat, and keystrokes aimed at
  // text fields (so typing in the chat still types a space).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== HOTKEY) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;
      if (typingInField(e.target)) return;
      e.preventDefault();
      toggle();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Expose play() to the parent (the live console starts it within its click gesture).
  useEffect(() => {
    if (!playRef) return;
    playRef.current = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.ended) v.currentTime = 0;
      void v.play();
    };
    return () => {
      playRef.current = null;
    };
  }, [playRef]);

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[300px] overflow-hidden rounded-lg border border-white/10 bg-[#0c0d12] shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5">
        <span
          className={
            'size-1.5 rounded-full ' + (playing ? 'animate-pulse bg-emerald-400' : 'bg-zinc-600')
          }
        />
        <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-400 uppercase">
          {LABEL}
        </span>
        {routedHint && playing && (
          <span className="rounded-sm border border-emerald-400/40 bg-emerald-400/10 px-1 font-mono text-[9px] tracking-[0.1em] text-emerald-300 uppercase">
            {routedHint}
          </span>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto text-zinc-500 hover:text-zinc-200"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? (
            <CaretDownIcon weight="bold" className="size-3.5" />
          ) : (
            <CaretUpIcon weight="bold" className="size-3.5" />
          )}
        </button>
      </div>

      <video
        ref={videoRef}
        src={SRC}
        preload="auto"
        playsInline
        hidden={!open}
        onPlay={() => {
          setPlaying(true);
          if (videoRef.current) onPlayStart?.(videoRef.current);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onClick={toggle}
        className="block w-full cursor-pointer bg-black"
      />

      <div className="flex items-center justify-between px-3 py-1.5 font-mono text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <PlayIcon weight="fill" className="size-2.5" />
          <span className="rounded-sm border border-white/15 px-1 text-zinc-300">Space</span>
          {playing ? 'playing' : 'play'}
        </span>
        <span>
          {clock(time)} / {clock(duration)}
        </span>
      </div>
    </div>
  );
}
