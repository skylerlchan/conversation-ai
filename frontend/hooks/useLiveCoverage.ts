import { useEffect, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import type { CoverageState } from '@/lib/demo/types';

const decoder = new TextDecoder();

/** One question card from the agent's `coverage_update` packet (coverage.py to_card). */
export interface LiveCard {
  id: string;
  question: string;
  pillar: string;
  state: CoverageState;
  facts: string[];
  contradictions: string[];
  followup: string;
}

export interface LiveSnapshot {
  company: string;
  ticker: string;
  thesis: string;
  questions: LiveCard[];
  counts: Record<string, number>;
}

/**
 * Subscribes to the diligence agent's data packets. The agent (agent-py) is a
 * silent listener that publishes the full coverage snapshot on every change as
 * `{ type: "coverage_update", data: <snapshot> }`. Returns the latest snapshot
 * (null until the first one arrives). Must be used inside a RoomContext.
 */
export function useLiveCoverage(): LiveSnapshot | null {
  const room = useRoomContext();
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);

  useEffect(() => {
    if (!room) return;
    const handle = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(decoder.decode(payload));
        if (msg?.type === 'coverage_update' && msg.data) {
          setSnapshot(msg.data as LiveSnapshot);
        }
      } catch {
        /* ignore non-JSON / unrelated packets */
      }
    };
    room.on(RoomEvent.DataReceived, handle);
    return () => {
      room.off(RoomEvent.DataReceived, handle);
    };
  }, [room]);

  return snapshot;
}
