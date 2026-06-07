import { useEffect, useMemo, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { type ConsoleModel, liveModel } from '@/lib/console-model';
import {
  type CoveragePacket,
  type GroundingPacket,
  type TranscriptPacket,
  type TranscriptPartialPacket,
  parseLivePacket,
} from '@/lib/live/types';
import { SEED_COVERAGE } from '@/lib/live/seed';

/**
 * Drives the analyst console from the live agent's data packets. Subscribes to the
 * room's reliable data messages and reduces the latest `coverage_update` snapshot +
 * the running `transcript`/`grounding` stream into the same ConsoleModel the scripted
 * replay produces — so the console UI is identical either way.
 *
 *   coverage_update    → replace the coverage snapshot (last-wins, drop-tolerant)
 *   transcript         → append a finalized turn to the live call
 *   transcript_partial → the in-progress caption for the turn being spoken now
 *   grounding          → append the Moss retrieval feed (matches per turn)
 *
 * The partial caption is what makes the transcript fill in word-by-word: it lands
 * continuously as STT recognizes speech, so the console shows a live line instead
 * of "Waiting for the call to start" until a whole turn finalizes. It's cleared the
 * moment its finalized `transcript` turn arrives (which supersedes it).
 *
 * Must be used within a RoomContext (the AgentSessionProvider / SessionProvider).
 */
export function useLiveDiligence(): ConsoleModel & { groundings: GroundingPacket[] } {
  const room = useRoomContext();
  // Seed the board with the hard-coded question list so it renders the instant
  // the room connects — no "Waiting for questions…" while the agent cold-starts
  // and preloads its Moss indexes. The first real `coverage_update` replaces this
  // (last-wins); ids match agent-py/questions.json so the swap is seamless.
  const [coverage, setCoverage] = useState<CoveragePacket | null>(SEED_COVERAGE);
  const [transcript, setTranscript] = useState<TranscriptPacket[]>([]);
  const [partial, setPartial] = useState<TranscriptPartialPacket | null>(null);
  const [groundings, setGroundings] = useState<GroundingPacket[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!room) return;

    const onData = (payload: Uint8Array) => {
      const packet = parseLivePacket(payload);
      if (!packet) return;
      switch (packet.type) {
        case 'coverage_update':
          setCoverage(packet.data);
          break;
        case 'transcript':
          // De-dupe by turn index so a re-published turn doesn't double-render.
          setTranscript((prev) =>
            prev.some((t) => t.t === packet.data.t) ? prev : [...prev, packet.data]
          );
          // The finalized turn supersedes the live caption it grew from; drop it so
          // the next turn streams from empty (the agent resets its caption too).
          setPartial(null);
          break;
        case 'transcript_partial':
          // Superseding update: the latest cumulative caption for the current turn.
          setPartial(packet.data);
          break;
        case 'grounding':
          setGroundings((prev) => [...prev, packet.data]);
          break;
      }
    };

    const onConnected = () => setConnected(true);
    const onDisconnected = () => setConnected(false);

    setConnected(room.state === 'connected');
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  const model = useMemo(
    () => liveModel({ coverage, transcript, partial, groundings, live: connected }),
    [coverage, transcript, partial, groundings, connected]
  );

  return { ...model, groundings };
}
