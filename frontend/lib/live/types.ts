// The live data-packet contract between the Python agent (DiligenceListener) and
// the analyst console. The agent publishes reliable LiveKit data messages shaped
// as `{ type, data }` where `data` always carries a `timestamp` in epoch SECONDS
// (multiply by 1000 for JS Date). See agent-py/src/agent.py `_publish`.
//
// Four packet types drive the live console:
//   - coverage_update    : the full question state machine (CallState.snapshot())
//   - grounding          : the Moss retrieval for one researcher turn
//   - transcript         : one finalized turn of the live call (labeled by speaker)
//   - transcript_partial : the in-progress caption for the turn being spoken now
//
// coverage_update is a FULL snapshot (last-wins replace) so a dropped packet
// self-heals on the next one. grounding/transcript are per-turn appends, and
// transcript_partial is a superseding (cumulative) caption for the live turn.
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
  /** Concise source-tagged notes from the Moss corpus, shown when the question is
   * clicked. Each a short "fact — source" line. May be absent on older packets. */
  notes?: string[];
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

/**
 * `grounding.data` — a summarized digest of the analyst's own notes/filings,
 * surfaced periodically (every SUMMARY_EVERY turns in the agent), not per turn.
 * The grader still checks notes every turn for live contradictions; this is the
 * calm, analyst-readable context feed. `through_turn` is the latest turn covered.
 */
export interface GroundingPacket {
  summary: string;
  through_turn?: number;
  /** One-line gist of the most recent substantive researcher answer (the turn's
   * distilled facts), for the console's "THEY SAID". Absent on older packets. */
  answer?: string;
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

/**
 * `transcript_partial.data` — the in-progress (interim) caption for the turn being
 * spoken right now. `text` is the FULL cumulative caption so far (a superseding
 * update, not a delta), so words appear live as they're recognized. Superseded by
 * the finalized `transcript` packet for the same speech, after which the agent
 * resets and the next turn streams from empty. See agent-py `publish_partial`.
 */
export interface TranscriptPartialPacket {
  speaker: Speaker;
  text: string;
  timestamp: number;
}

export type PacketType = 'coverage_update' | 'grounding' | 'transcript' | 'transcript_partial';

export type LivePacket =
  | { type: 'coverage_update'; data: CoveragePacket }
  | { type: 'grounding'; data: GroundingPacket }
  | { type: 'transcript'; data: TranscriptPacket }
  | { type: 'transcript_partial'; data: TranscriptPartialPacket };

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
    type !== 'transcript_partial'
  )
    return null;
  return { type, data } as LivePacket;
}
