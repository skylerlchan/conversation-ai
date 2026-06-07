import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConsoleEvidence } from '@/lib/console-model';
import {
  type CallFixture,
  type CoverageState,
  type FlagCard,
  type FollowupCard,
  type QuestionsFixture,
  type ThesisDeltaCard,
  type Turn,
} from '@/lib/demo/types';

export type CopilotEventType = 'grounding' | 'followup' | 'flag' | 'thesis' | 'nudge';

export interface CopilotEvent {
  id: string;
  turn: number;
  type: CopilotEventType;
  questionId?: string;
  text: string;
}

export interface DiligenceState {
  /** Number of turns played so far (0..turns.length). */
  cursor: number;
  total: number;
  playing: boolean;
  done: boolean;
  speedMs: number;
  /** Current coverage state for every question id. */
  coverage: Record<string, CoverageState>;
  /** Turns played so far, in order. */
  transcript: Turn[];
  /** Active (unresolved) follow-ups the analyst should still ask. */
  activeFollowups: FollowupCard[];
  /** All inconsistency flags fired so far. */
  flags: FlagCard[];
  /** Per-researcher-turn grounded context (newest last). Drives the Context panel. */
  evidence: ConsoleEvidence[];
  /** Thesis-delta cards accumulated so far. */
  thesisDeltas: ThesisDeltaCard[];
  /** Chronological copilot activity feed (newest last). */
  copilotEvents: CopilotEvent[];
  /** Coverage tally for the header. */
  tally: { answered: number; partial: number; unanswered: number; total: number };
}

export interface DiligenceControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  step: () => void;
  back: () => void;
  reset: () => void;
  restart: () => void;
  setSpeedMs: (ms: number) => void;
}

const DEFAULT_SPEED_MS = 2600;

function initialCoverage(questions: QuestionsFixture): Record<string, CoverageState> {
  const cov: Record<string, CoverageState> = {};
  for (const q of questions.questions) {
    cov[q.id] = 'unanswered';
  }
  return cov;
}

/**
 * Drives the scripted AAPL diligence call through the coverage state machine.
 * Each researcher turn's `expected` block is applied exactly as the live
 * coverage engine would, so the console renders the same cards either way.
 */
export function useDiligenceDemo(
  questions: QuestionsFixture,
  call: CallFixture,
  opts?: { externalClock?: boolean }
): DiligenceState & { controls: DiligenceControls } {
  // When an external clock drives advancement (e.g. per-turn audio finishing),
  // the internal interval is disabled so the two can't double-advance.
  const externalClock = opts?.externalClock ?? false;
  const turns = call.turns;
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(DEFAULT_SPEED_MS);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const done = cursor >= turns.length;

  // Auto-advance while playing.
  useEffect(() => {
    if (!playing) return;
    if (done) {
      setPlaying(false);
      return;
    }
    if (externalClock) return; // audio drives advancement; no internal interval
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= turns.length) return c;
        return c + 1;
      });
    }, speedMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speedMs, done, turns.length, externalClock]);

  const controls = useMemo<DiligenceControls>(
    () => ({
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      toggle: () => setPlaying((p) => !p),
      step: () => setCursor((c) => Math.min(c + 1, turns.length)),
      back: () => setCursor((c) => Math.max(c - 1, 0)),
      reset: () => {
        setPlaying(false);
        setCursor(0);
      },
      restart: () => {
        setCursor(0);
        setPlaying(true);
      },
      setSpeedMs: (ms: number) => setSpeedMs(ms),
    }),
    [turns.length]
  );

  // Derive the full view-model from the first `cursor` turns.
  const derived = useMemo(() => {
    const coverage = initialCoverage(questions);
    const transcript: Turn[] = [];
    const flags: FlagCard[] = [];
    const thesisDeltas: ThesisDeltaCard[] = [];
    const copilotEvents: CopilotEvent[] = [];
    const evidence: ConsoleEvidence[] = [];
    const followupByQid = new Map<string, FollowupCard>();

    const played = turns.slice(0, cursor);

    for (const turn of played) {
      transcript.push(turn);

      // Analyst nudge prompted by the copilot.
      if (turn.speaker === 'analyst' && typeof turn.prompted_by_copilot === 'string') {
        copilotEvents.push({
          id: `nudge-${turn.t}`,
          turn: turn.t,
          type: 'nudge',
          questionId: turn.asks?.[0],
          text: turn.prompted_by_copilot,
        });
      }

      const exp = turn.expected;
      if (turn.speaker !== 'researcher' || !exp) continue;

      // Apply the coverage verdict (forward-only by construction).
      for (const [qid, state] of Object.entries(exp.coverage)) {
        coverage[qid] = state;
      }

      const primaryQid = exp.addresses[0];

      if (exp.followup) {
        followupByQid.set(primaryQid, {
          id: `fu-${turn.t}-${primaryQid}`,
          questionId: primaryQid,
          text: exp.followup,
          turn: turn.t,
          resolved: false,
        });
      }

      if (exp.contradiction) {
        flags.push({
          id: `flag-${turn.t}-${primaryQid}`,
          questionId: primaryQid,
          vs: exp.contradiction.vs,
          detail: exp.contradiction.detail,
          turn: turn.t,
        });
      }

      if (exp.thesis_delta) {
        thesisDeltas.push({
          id: `td-${turn.t}-${primaryQid}`,
          questionId: primaryQid,
          text: exp.thesis_delta,
          turn: turn.t,
        });
      }

      // Context-panel evidence for this researcher turn: what they said, the
      // grounded note/corpus snippets it was checked against, the extracted
      // facts, and any contradiction with the analyst's model.
      evidence.push({
        turn: turn.t,
        questionId: primaryQid,
        claim: turn.text,
        facts: exp.extracted_facts ?? [],
        sources: (turn.grounding ?? []).map((g) => ({
          label: g.label,
          text: g.text,
          score: g.score,
        })),
        contradiction: exp.contradiction
          ? { vs: exp.contradiction.vs, detail: exp.contradiction.detail }
          : undefined,
      });

      // Copilot activity classification (one event per researcher turn).
      const type: CopilotEventType = exp.contradiction
        ? 'flag'
        : exp.followup
          ? 'followup'
          : exp.thesis_delta
            ? 'thesis'
            : 'grounding';
      copilotEvents.push({
        id: `ev-${turn.t}`,
        turn: turn.t,
        type,
        questionId: primaryQid,
        text: turn.copilot_surfaced ?? '',
      });
    }

    // A follow-up is active until its question reaches `answered`.
    const activeFollowups: FollowupCard[] = [];
    for (const card of followupByQid.values()) {
      const resolved = coverage[card.questionId] === 'answered';
      if (!resolved) activeFollowups.push({ ...card, resolved });
    }

    let answered = 0;
    let partial = 0;
    let unanswered = 0;
    for (const q of questions.questions) {
      const s = coverage[q.id];
      if (s === 'answered') answered++;
      else if (s === 'partial') partial++;
      else unanswered++;
    }

    return {
      coverage,
      transcript,
      activeFollowups,
      flags,
      thesisDeltas,
      copilotEvents,
      evidence,
      tally: { answered, partial, unanswered, total: questions.questions.length },
    };
  }, [cursor, questions, turns]);

  return {
    cursor,
    total: turns.length,
    playing,
    done,
    speedMs,
    ...derived,
    controls,
  };
}
