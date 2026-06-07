// A "session" is what the console replays — produced either from the real
// analysis engine (/api/analyze over a live earnings transcript) or from a
// scripted fixture. One shape, two sources.
import type { CoverageState, ExpectedVerdict, Pillar, ThesisDelta } from '@/lib/demo/types';

export type TurnRole = 'self' | 'subject';

export interface SessionTurn {
  t: number;
  /** Display label, e.g. "CEO — Brett Schulman" or "You (buy-side)". */
  speaker: string;
  /** `self` = the buy-side user (right side); `subject` = whoever they listen to. */
  role: TurnRole;
  text: string;
  asks?: string[];
  is_followup?: boolean;
  prompted_by_copilot?: boolean | string;
  /** The coverage verdict for this turn (present on subject turns). */
  expected?: ExpectedVerdict;
  copilot_surfaced?: string;
}

export interface SessionQuestion {
  id: string;
  text: string;
  topic?: string;
}

export interface SessionMeta {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  industry: string;
  price: number;
  marketCap: number;
  /** e.g. "Q1 FY2026". */
  period: string;
  date: string;
  thesis: string;
  /** How the session was produced. */
  source: 'real-earnings' | 'scripted';
  /** Short, human label for the kind of call. */
  callKind: string;
}

export interface Session {
  meta: SessionMeta;
  questions: SessionQuestion[];
  turns: SessionTurn[];
  final_coverage: Record<string, CoverageState>;
  thesis_delta: ThesisDelta;
  /** Investment-thesis pillars grouping the questions (optional). */
  pillars?: Pillar[];
}

export type { CoverageState, ExpectedVerdict, Pillar, ThesisDelta };
