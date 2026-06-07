import { useEffect, useMemo, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { type ConsoleModel, liveModel } from '@/lib/console-model';
import {
  type CoveragePacket,
  type GroundingPacket,
  type TranscriptPacket,
  parseLivePacket,
} from '@/lib/live/types';

/**
 * Drives the analyst console from the live agent's data packets. Subscribes to the
 * room's reliable data messages and reduces the latest `coverage_update` snapshot +
 * the running `transcript`/`grounding` stream into the same ConsoleModel the scripted
 * replay produces — so the console UI is identical either way.
 *
 *   coverage_update → replace the coverage snapshot (last-wins, drop-tolerant)
 *   transcript      → append a turn to the live call
 *   grounding       → append the Moss retrieval feed (matches per turn)
 *
 * Must be used within a RoomContext (the AgentSessionProvider / SessionProvider).
 */
export function useLiveDiligence(): ConsoleModel & { groundings: GroundingPacket[] } {
  const room = useRoomContext();
  const [coverage, setCoverage] = useState<CoveragePacket | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPacket[]>([]);
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
    () => liveModel({ coverage, transcript, live: connected }),
    [coverage, transcript, connected]
  );

  return { ...model, groundings };
}
