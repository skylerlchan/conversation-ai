// Types for the Diligence-Call Copilot demo data contract.
//
// These mirror the fixtures in `agent-py/demo/` (the source of truth):
// `cava_questions.json` (pre-call question list + modeled assumptions) and
// `cava_call.json` (the scripted call, each researcher turn carrying the
// `expected` coverage verdict the live coverage engine must reproduce).

/** The coverage state machine: states only ever move forward. */
export type CoverageState = 'unanswered' | 'partial' | 'answered';

export interface Company {
  name: string;
  ticker: string;
  exchange: string;
  sector: string;
}

export interface Counterpart {
  side: string;
  firm: string;
  analyst: string;
  note: string;
}

export interface Question {
  id: string;
  text: string;
  why: string;
  demo_role: string;
  expected_outcome: string;
}

export interface QuestionsFixture {
  company: Company;
  counterpart: Counterpart;
  thesis: string;
  thesis_memo: string;
  modeled_assumptions: Record<string, string>;
  questions: Question[];
}

export interface Contradiction {
  /** What the answer contradicts: usually the published "note", or an "earlier_turn". */
  vs: string;
  detail: string;
}

/** The coverage-engine output contract, per the plan. */
export interface ExpectedVerdict {
  addresses: string[];
  coverage: Record<string, CoverageState>;
  extracted_facts: string[];
  contradiction: Contradiction | null;
  followup: string | null;
  thesis_delta: string | null;
}

export type Speaker = 'analyst' | 'researcher';

export interface Turn {
  t: number;
  speaker: Speaker;
  text: string;
  asks?: string[];
  is_followup_for?: string;
  /** true, or a copilot nudge string, when this analyst turn was prompted by the copilot. */
  prompted_by_copilot?: boolean | string;
  /** Present on researcher turns: the golden coverage verdict for that turn. */
  expected?: ExpectedVerdict;
  /** Human-readable note on what the copilot put on screen for this turn. */
  copilot_surfaced?: string;
}

export interface ThesisChange {
  field: string;
  from: string;
  to: string;
  source_turn: number;
}

export interface ThesisDelta {
  summary: string;
  changes: ThesisChange[];
  net: string;
}

export interface CallFixture {
  company: string;
  summary: string;
  coverage_states: CoverageState[];
  turns: Turn[];
  final_coverage: Record<string, CoverageState>;
  thesis_delta: ThesisDelta;
}

// ---- Derived view-model types the console renders ----

export interface FollowupCard {
  id: string;
  questionId: string;
  text: string;
  /** Turn that produced it. */
  turn: number;
  resolved: boolean;
}

export interface FlagCard {
  id: string;
  questionId: string;
  vs: string;
  detail: string;
  turn: number;
}

export interface ThesisDeltaCard {
  id: string;
  questionId: string;
  text: string;
  turn: number;
}
