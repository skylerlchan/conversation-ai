// The normalized view-model the analyst console renders. Two sources produce it —
// the scripted fixture replay (useDiligenceDemo) and the live room packets
// (useLiveDiligence) — so the console UI is written once against ConsoleModel and
// driven by either. See components/console/mission-console.tsx (MissionConsoleView).
import type { CoverageState, QuestionsFixture } from '@/lib/demo/types';
import type { CoveragePacket, Speaker, TranscriptPacket } from '@/lib/live/types';

export interface ConsoleQuestion {
  id: string;
  text: string;
  pillar?: string;
}

export interface ConsoleFollowup {
  questionId: string;
  text: string;
}

export interface ConsoleFlag {
  questionId: string;
  vs: string;
  detail: string;
}

export interface ConsoleTurn {
  t: number | string;
  speaker: Speaker;
  text: string;
  prompted_by_copilot?: boolean | string;
}

export interface ConsoleModel {
  company: { ticker: string; name: string; exchange: string };
  callKind: string;
  questions: ConsoleQuestion[];
  coverage: Record<string, CoverageState>;
  activeFollowups: ConsoleFollowup[];
  flags: ConsoleFlag[];
  transcript: ConsoleTurn[];
  tally: { answered: number; partial: number; unanswered: number; total: number };
  /** Call is ongoing (LIVE) vs finished (ENDED). */
  live: boolean;
  /** Drives the waveform animation. */
  playing: boolean;
  /** The scripted call reached its end (fixture), or the live call ended. */
  done: boolean;
}

/** Pillar-id lookup for a model's questions. */
export function pillarOf(model: ConsoleModel): Record<string, string> {
  const map: Record<string, string> = {};
  for (const q of model.questions) if (q.pillar) map[q.id] = q.pillar;
  return map;
}

/** First not-yet-answered question, for the "cover next" step. */
export function nextMissed(model: ConsoleModel): ConsoleQuestion | undefined {
  return model.questions.find((q) => (model.coverage[q.id] ?? 'unanswered') === 'unanswered');
}

// ---- Live adapter: build a ConsoleModel from accumulated room packets ----

/**
 * Reduce the latest coverage snapshot + the running transcript into a ConsoleModel.
 * Coverage is a full-snapshot replace (last-wins), so this is a pure function of the
 * most recent `coverage_update` plus the appended transcript turns.
 */
export function liveModel(args: {
  coverage: CoveragePacket | null;
  transcript: TranscriptPacket[];
  live: boolean;
  callKind?: string;
}): ConsoleModel {
  const { coverage, transcript, live } = args;
  const cards = coverage?.questions ?? [];

  const coverageMap: Record<string, CoverageState> = {};
  const activeFollowups: ConsoleFollowup[] = [];
  const flags: ConsoleFlag[] = [];
  for (const c of cards) {
    coverageMap[c.id] = c.state;
    // A follow-up is active until its question is answered (mirrors the engine).
    if (c.followup && c.state !== 'answered') {
      activeFollowups.push({ questionId: c.id, text: c.followup });
    }
    for (const detail of c.contradictions ?? []) {
      flags.push({ questionId: c.id, vs: 'note', detail });
    }
  }

  const counts = coverage?.counts ?? { unanswered: 0, partial: 0, answered: 0 };
  const total = cards.length;

  return {
    company: {
      ticker: coverage?.ticker ?? '',
      name: coverage?.company ?? '',
      exchange: '',
    },
    callKind: args.callKind ?? 'Diligence call · live',
    questions: cards.map((c) => ({ id: c.id, text: c.question, pillar: c.pillar })),
    coverage: coverageMap,
    activeFollowups,
    flags,
    transcript: transcript.map((t) => ({
      t: t.t,
      speaker: t.speaker,
      text: t.text,
      prompted_by_copilot: t.prompted_by_copilot,
    })),
    tally: {
      answered: counts.answered,
      partial: counts.partial,
      unanswered: counts.unanswered,
      total,
    },
    live,
    playing: live,
    done: !live,
  };
}

// ---- Fixture adapter: build a ConsoleModel from the scripted replay state ----

interface FixtureState {
  coverage: Record<string, CoverageState>;
  transcript: { t: number; speaker: Speaker; text: string; prompted_by_copilot?: boolean | string }[];
  activeFollowups: { questionId: string; text: string }[];
  flags: { questionId: string; vs: string; detail: string }[];
  tally: { answered: number; partial: number; unanswered: number; total: number };
  playing: boolean;
  done: boolean;
}

/** Adapt the scripted replay state + its fixture metadata into a ConsoleModel. */
export function fixtureModel(state: FixtureState, fixture: QuestionsFixture): ConsoleModel {
  const pillar: Record<string, string> = {};
  for (const p of fixture.pillars) for (const qid of p.questions) pillar[qid] = p.thesis;

  return {
    company: {
      ticker: fixture.company.ticker,
      name: fixture.company.name.replace(', Inc.', ''),
      exchange: fixture.company.exchange,
    },
    callKind: 'Diligence call · sell-side',
    questions: fixture.questions.map((q) => ({ id: q.id, text: q.text, pillar: pillar[q.id] })),
    coverage: state.coverage,
    activeFollowups: state.activeFollowups.map((f) => ({ questionId: f.questionId, text: f.text })),
    flags: state.flags.map((f) => ({ questionId: f.questionId, vs: f.vs, detail: f.detail })),
    transcript: state.transcript.map((t) => ({
      t: t.t,
      speaker: t.speaker,
      text: t.text,
      prompted_by_copilot: t.prompted_by_copilot,
    })),
    tally: state.tally,
    live: !state.done,
    playing: state.playing,
    done: state.done,
  };
}
