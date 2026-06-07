// The normalized view-model the analyst console renders. Two sources produce it —
// the scripted fixture replay (useDiligenceDemo) and the live room packets
// (useLiveDiligence) — so the console UI is written once against ConsoleModel and
// driven by either. See components/console/mission-console.tsx (MissionConsoleView).
import type { CoverageState, QuestionsFixture } from '@/lib/demo/types';
import type {
  CoveragePacket,
  GroundingPacket,
  Speaker,
  TranscriptPacket,
  TranscriptPartialPacket,
} from '@/lib/live/types';

export interface ConsoleQuestion {
  id: string;
  text: string;
  pillar?: string;
  /** Concise source-tagged notes from the Moss corpus, shown when the question is
   * clicked. Each a short "fact — source" line. */
  notes?: string[];
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

/** One grounded snippet behind a turn — what the analyst's note / corpus says. */
export interface ConsoleEvidenceSource {
  /** Where the snippet came from, e.g. "Your note · modeled" or "Filing (corpus)". */
  label: string;
  text: string;
  score?: number;
}

/**
 * The "context on what they just said" for one researcher turn: the live claim,
 * the grounded note/corpus snippets it was checked against, the facts the engine
 * pulled out, and any contradiction with the analyst's model. Drives the console
 * Context panel.
 */
export interface ConsoleEvidence {
  /** Transcript turn this context belongs to. */
  turn: number | string;
  /** The question it primarily addresses, when known. */
  questionId?: string;
  /** What the researcher actually said (the turn text). */
  claim: string;
  /** Facts the engine extracted from the turn. */
  facts: string[];
  /** Grounded note/corpus snippets the claim was checked against. */
  sources: ConsoleEvidenceSource[];
  /** Set when the claim contradicts the analyst's model. */
  contradiction?: { vs: string; detail: string };
}

export interface ConsoleTurn {
  t: number | string;
  speaker: Speaker;
  text: string;
  prompted_by_copilot?: boolean | string;
  /** In-progress live caption (not yet a finalized turn). Rendered with a live cursor. */
  interim?: boolean;
}

export interface ConsoleModel {
  company: { ticker: string; name: string; exchange: string };
  callKind: string;
  questions: ConsoleQuestion[];
  coverage: Record<string, CoverageState>;
  activeFollowups: ConsoleFollowup[];
  flags: ConsoleFlag[];
  transcript: ConsoleTurn[];
  /** Per-researcher-turn grounded context, oldest first. The Context panel shows the latest. */
  evidence: ConsoleEvidence[];
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

/** One thesis pillar (a leg of the investment case) with its questions + coverage. */
export interface PillarGroup {
  /** Sequential display id (P1, P2 …), assigned in first-seen order. */
  id: string;
  /** Short pillar name — the text before the first ":" in the pillar string. */
  label: string;
  /** The fuller thesis claim — the text after the ":", when the source provides one. */
  claim?: string;
  questions: ConsoleQuestion[];
  counts: { answered: number; partial: number; unanswered: number };
  total: number;
  allDone: boolean;
  anyThin: boolean;
}

/** Split a pillar string into a short label + (optional) longer claim on the first colon. */
function splitPillar(pillar: string): { label: string; claim?: string } {
  const i = pillar.indexOf(':');
  if (i > 0 && i < pillar.length - 1) {
    return { label: pillar.slice(0, i).trim(), claim: pillar.slice(i + 1).trim() };
  }
  return { label: pillar.trim() || 'Ungrouped' };
}

/**
 * Group a model's questions under their thesis pillar, preserving first-seen order,
 * and roll up per-pillar coverage. Works for both the live and fixture paths because
 * each carries the pillar string on every ConsoleQuestion.
 */
export function pillarGroups(model: ConsoleModel): PillarGroup[] {
  const order: string[] = [];
  const byPillar = new Map<string, ConsoleQuestion[]>();
  for (const q of model.questions) {
    const key = q.pillar ?? '';
    const bucket = byPillar.get(key);
    if (bucket) {
      bucket.push(q);
    } else {
      byPillar.set(key, [q]);
      order.push(key);
    }
  }

  return order.map((key, index) => {
    const questions = byPillar.get(key)!;
    const counts = { answered: 0, partial: 0, unanswered: 0 };
    for (const q of questions) counts[model.coverage[q.id] ?? 'unanswered'] += 1;
    const total = questions.length;
    return {
      id: `P${index + 1}`,
      ...splitPillar(key),
      questions,
      counts,
      total,
      allDone: total > 0 && counts.answered === total,
      anyThin: counts.partial > 0,
    };
  });
}

/** The pillar that holds the next actionable question (active follow-up, else next missed). */
export function activePillarId(model: ConsoleModel, groups: PillarGroup[]): string | undefined {
  const activeQid = model.activeFollowups[0]?.questionId ?? nextMissed(model)?.id;
  if (!activeQid) return undefined;
  return groups.find((g) => g.questions.some((q) => q.id === activeQid))?.id;
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
  /** The in-progress caption for the turn being spoken now (word-by-word), if any. */
  partial?: TranscriptPartialPacket | null;
  /** Moss retrieval feed (one per scored researcher turn), oldest first. */
  groundings?: GroundingPacket[];
  live: boolean;
  callKind?: string;
}): ConsoleModel {
  const { coverage, transcript, partial, live } = args;
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

  // Context-panel evidence: each grounding packet is a summarized digest of the
  // analyst's own notes/filings over a window of turns (surfaced periodically, not
  // per turn). Newest digest -> newest context. Contradictions live on the
  // coverage cards (the board flags them). "THEY SAID" is the latest researcher
  // turn at/before `through_turn` — the live transcript carries the quote, the
  // grounding only the digest.
  // "THEY SAID" is a one-line gist of the researcher's last real answer, carried on
  // the grounding packet (`answer`) — the agent distills it from the turn's extracted
  // facts, so operator hand-offs / filler never surface. Fall back, for older packets
  // with no `answer`, to the newest substantive (>= 6 word) researcher turn.
  const isSubstantive = (text: string) => text.trim().split(/\s+/).filter(Boolean).length >= 6;
  const evidence: ConsoleEvidence[] = (args.groundings ?? []).map((g, i) => {
    const candidates = transcript.filter(
      (tp) => tp.speaker === 'researcher' && (g.through_turn == null || tp.t <= g.through_turn)
    );
    const fallback = candidates.filter((tp) => isSubstantive(tp.text)).at(-1) ?? candidates.at(-1);
    return {
      turn: g.through_turn ?? `g${i}`,
      claim: g.answer?.trim() || fallback?.text || '',
      facts: [],
      sources: [{ label: 'Your research · Moss (summary)', text: g.summary }],
    };
  });

  return {
    company: {
      ticker: coverage?.ticker ?? '',
      name: coverage?.company ?? '',
      exchange: '',
    },
    callKind: args.callKind ?? 'Diligence call · live',
    questions: cards.map((c) => ({
      id: c.id,
      text: c.question,
      pillar: c.pillar,
      notes: c.notes,
    })),
    coverage: coverageMap,
    activeFollowups,
    flags,
    // Finalized turns, plus the in-progress caption appended last so it reads as the
    // current (live) line — this is what fills the transcript in word-by-word and
    // keeps the console off "Waiting for the call to start" once speech is heard.
    transcript: [
      ...transcript.map((t) => ({
        t: t.t,
        speaker: t.speaker,
        text: t.text,
        prompted_by_copilot: t.prompted_by_copilot,
      })),
      ...(partial && partial.text
        ? [{ t: 'live' as const, speaker: partial.speaker, text: partial.text, interim: true }]
        : []),
    ],
    evidence,
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
  transcript: {
    t: number;
    speaker: Speaker;
    text: string;
    prompted_by_copilot?: boolean | string;
  }[];
  activeFollowups: { questionId: string; text: string }[];
  flags: { questionId: string; vs: string; detail: string }[];
  evidence: ConsoleEvidence[];
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
    questions: fixture.questions.map((q) => ({
      id: q.id,
      text: q.text,
      pillar: pillar[q.id],
      notes: q.notes,
    })),
    coverage: state.coverage,
    activeFollowups: state.activeFollowups.map((f) => ({ questionId: f.questionId, text: f.text })),
    flags: state.flags.map((f) => ({ questionId: f.questionId, vs: f.vs, detail: f.detail })),
    evidence: state.evidence,
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
