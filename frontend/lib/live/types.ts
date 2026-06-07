// The live data-packet contract between the Python agent (DiligenceListener) and
// the analyst console. The agent publishes reliable LiveKit data messages shaped
// as `{ type, data }` where `data` always carries a `timestamp` in epoch SECONDS
// (multiply by 1000 for JS Date). See agent-py/src/agent.py `_publish`.
//
// Three packet types drive the live console:
//   - coverage_update : the full question state machine (CallState.snapshot())
//   - grounding       : the Moss retrieval for one researcher turn
//   - transcript      : one finalized turn of the live call (labeled by speaker)
//
// coverage_update is a FULL snapshot (last-wins replace) so a dropped packet
// self-heals on the next one. grounding/transcript are per-turn appends.
import type { CoverageState } from '@/lib/demo/types';

/** One question card inside a coverage snapshot. Mirrors QuestionState.to_card(). */
export interface CoverageCard {
  id: string;
  question: string;
  pillar: string;
  state: CoverageState;
  facts: string[];
  contradictions: string[];
  /** The gap-closing follow-up to ask while the question is thin; null once answered. */
  followup: string | null;
}

/** `coverage_update.data` — the whole call state. Mirrors CallState.snapshot(). */
export interface CoveragePacket {
  company: string;
  ticker: string;
  thesis: string;
  questions: CoverageCard[];
  counts: { unanswered: number; partial: number; answered: number };
  timestamp: number;
}

export interface GroundingMatch {
  text: string;
  score?: number;
}

/** `grounding.data` — the Moss top-k retrieval for the turn in `query`. */
export interface GroundingPacket {
  query: string;
  matches: GroundingMatch[];
  timestamp: number;
}

export type Speaker = 'analyst' | 'researcher';

/** `transcript.data` — one finalized turn of the live call. */
export interface TranscriptPacket {
  /** Monotonic turn index from the agent. */
  t: number;
  speaker: Speaker;
  text: string;
  /** true, or a copilot nudge string, when an analyst turn was prompted by the copilot. */
  prompted_by_copilot?: boolean | string;
  timestamp: number;
}

/** `interim_transcript.data` — the in-progress utterance, streamed as the speaker
 * talks (replaced in place until the turn finalizes into a `transcript` packet). */
export interface InterimTranscriptPacket {
  speaker: Speaker;
  text: string;
  timestamp: number;
}

export type PacketType = 'coverage_update' | 'grounding' | 'transcript' | 'interim_transcript';

export type LivePacket =
  | { type: 'coverage_update'; data: CoveragePacket }
  | { type: 'grounding'; data: GroundingPacket }
  | { type: 'transcript'; data: TranscriptPacket }
  | { type: 'interim_transcript'; data: InterimTranscriptPacket };

const decoder = new TextDecoder();

/**
 * Parse a raw LiveKit data payload into a typed LivePacket, or null if it isn't
 * one of ours. Defensive: never throws on malformed input.
 */
export function parseLivePacket(payload: Uint8Array): LivePacket | null {
  let msg: unknown;
  try {
    msg = JSON.parse(decoder.decode(payload));
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  const { type, data } = msg as { type?: unknown; data?: unknown };
  if (typeof type !== 'string' || !data || typeof data !== 'object') return null;
  if (
    type !== 'coverage_update' &&
    type !== 'grounding' &&
    type !== 'transcript' &&
    type !== 'interim_transcript'
  )
    return null;
  return { type, data } as LivePacket;
}
