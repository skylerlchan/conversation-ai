'use client';

import { useCallback, useEffect, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { MissionConsoleView } from '@/components/console/mission-console';
import { liveModel } from '@/lib/console-model';
import {
  type CoveragePacket,
  type InterimTranscriptPacket,
  type TranscriptPacket,
  parseLivePacket,
} from '@/lib/live/types';

/**
 * Pre-call gate. The click connects to the room (receive-only) and unlocks audio
 * playback. No microphone is requested — we never publish; the call audio is the
 * real recording streamed by another participant, transcribed by the agent.
 */
function StartGate({
  onStart,
  connecting,
  error,
}: {
  onStart: () => void;
  connecting: boolean;
  error: string | null;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#0a0b0f] px-6 text-zinc-200">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        <span className="font-mono text-[11px] font-medium tracking-[0.28em] text-zinc-400 uppercase">
          Diligence Copilot — Live
        </span>
      </div>
      <h1 className="max-w-xl text-center text-2xl font-semibold tracking-tight text-white">
        A live expert call — real audio, live transcription
      </h1>
      <p className="max-w-md text-center text-[15px] leading-relaxed text-zinc-400">
        Press start to join the call. The copilot transcribes the audio live (LiveKit STT), grounds
        each answer against your model (Moss), and your questions tick as the expert speaks.
      </p>
      <button
        onClick={onStart}
        disabled={connecting}
        className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-black transition-transform hover:scale-[1.01] hover:bg-zinc-100 disabled:opacity-60"
      >
        {connecting ? 'Connecting…' : 'Start call'}
        {!connecting && <ArrowRightIcon weight="bold" className="size-4" />}
      </button>
      {error && <p className="max-w-md text-center font-mono text-[12px] text-red-400">{error}</p>}
    </div>
  );
}

/**
 * The live analyst console wired to the LiveKit room — receive-only (no mic).
 * The Python agent (DiligenceListener) does live STT + Moss grounding + coverage
 * scoring and publishes coverage/transcript/interim packets; a separate
 * participant streams the real call audio (played here via RoomAudioRenderer).
 * This is the actual live backend, not a replay.
 */
export function LiveCallConsole() {
  const [room] = useState(() => new Room());
  const [started, setStarted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [coverage, setCoverage] = useState<CoveragePacket | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPacket[]>([]);
  const [interim, setInterim] = useState<InterimTranscriptPacket | null>(null);

  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      const packet = parseLivePacket(payload);
      if (!packet) return;
      switch (packet.type) {
        case 'coverage_update':
          setCoverage(packet.data);
          break;
        case 'transcript':
          // A committed turn supersedes the in-progress interim line.
          setInterim(null);
          setTranscript((prev) =>
            prev.some((t) => t.t === packet.data.t) ? prev : [...prev, packet.data]
          );
          break;
        case 'interim_transcript':
          setInterim(packet.data);
          break;
      }
    };
    const onDisconnected = () => setLive(false);
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  useEffect(() => () => void room.disconnect(), [room]);

  const onStart = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      // POST /api/token mints a token for the fixed demo room (DEMO_ROOM) and
      // stamps an agent-py dispatch, so the agent joins this same room.
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`token: ${res.status}`);
      const { serverUrl, participantToken } = await res.json();
      // Receive-only: connect without publishing a microphone track.
      await room.connect(serverUrl, participantToken);
      setLive(true);
      setStarted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, [room]);

  const model = liveModel({
    coverage,
    transcript,
    groundings: [],
    live,
    callKind: 'Expert call · live audio',
  });

  return (
    <RoomContext.Provider value={room}>
      {!started ? (
        <StartGate onStart={onStart} connecting={connecting} error={error} />
      ) : (
        <MissionConsoleView model={model} liveTurn={interim} />
      )}
      <RoomAudioRenderer />
    </RoomContext.Provider>
  );
}
