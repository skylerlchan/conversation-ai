import { useEffect, useMemo, useRef, useState } from 'react';
import type { CoverageState, FlagCard, FollowupCard, ThesisDeltaCard } from '@/lib/demo/types';
import type { Session, SessionTurn } from '@/lib/session';

export type CopilotEventType = 'grounding' | 'followup' | 'flag' | 'thesis' | 'nudge';

export interface CopilotEvent {
  id: string;
  turn: number;
  type: CopilotEventType;
  questionId?: string;
  text: string;
}

const DEFAULT_SPEED_MS = 2600;

/**
 * Replays a Session (scripted fixture or live-analyzed) through the coverage
 * state machine. Source-agnostic: it applies each subject turn's `expected`
 * verdict exactly as the live engine would.
 */
export function useSessionReplay(session: Session) {
  const turns = session.turns;
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(DEFAULT_SPEED_MS);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const done = cursor >= turns.length;

  // Reset when the session identity changes.
  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [session]);

  useEffect(() => {
    if (!playing) return;
    if (done) {
      setPlaying(false);
      return;
    }
    timer.current = setInterval(() => {
      setCursor((c) => (c >= turns.length ? c : c + 1));
    }, speedMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speedMs, done, turns.length]);

  const controls = useMemo(
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

  const derived = useMemo(() => {
    const coverage: Record<string, CoverageState> = {};
    for (const q of session.questions) coverage[q.id] = 'unanswered';

    const transcript: SessionTurn[] = [];
    const flags: FlagCard[] = [];
    const thesisDeltas: ThesisDeltaCard[] = [];
    const copilotEvents: CopilotEvent[] = [];
    const followupByQid = new Map<string, FollowupCard>();

    for (const turn of turns.slice(0, cursor)) {
      transcript.push(turn);

      if (typeof turn.prompted_by_copilot === 'string') {
        copilotEvents.push({
          id: `nudge-${turn.t}`,
          turn: turn.t,
          type: 'nudge',
          questionId: turn.asks?.[0],
          text: turn.prompted_by_copilot,
        });
      }

      const exp = turn.expected;
      if (!exp) continue;

      for (const [qid, state] of Object.entries(exp.coverage)) coverage[qid] = state;
      const primary = exp.addresses[0];

      if (exp.followup && primary) {
        followupByQid.set(primary, {
          id: `fu-${turn.t}-${primary}`,
          questionId: primary,
          text: exp.followup,
          turn: turn.t,
          resolved: false,
        });
      }
      if (exp.contradiction && primary) {
        flags.push({
          id: `flag-${turn.t}-${primary}`,
          questionId: primary,
          vs: exp.contradiction.vs,
          detail: exp.contradiction.detail,
          turn: turn.t,
        });
      }
      if (exp.thesis_delta && primary) {
        thesisDeltas.push({
          id: `td-${turn.t}-${primary}`,
          questionId: primary,
          text: exp.thesis_delta,
          turn: turn.t,
        });
      }

      copilotEvents.push({
        id: `ev-${turn.t}`,
        turn: turn.t,
        type: exp.contradiction
          ? 'flag'
          : exp.followup
            ? 'followup'
            : exp.thesis_delta
              ? 'thesis'
              : 'grounding',
        questionId: primary,
        text: turn.copilot_surfaced ?? '',
      });
    }

    const activeFollowups: FollowupCard[] = [];
    for (const card of followupByQid.values()) {
      if (coverage[card.questionId] !== 'answered') activeFollowups.push(card);
    }

    let answered = 0;
    let partial = 0;
    let unanswered = 0;
    for (const q of session.questions) {
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
      tally: { answered, partial, unanswered, total: session.questions.length },
    };
  }, [cursor, session, turns]);

  return { cursor, total: turns.length, playing, done, speedMs, ...derived, controls };
}
