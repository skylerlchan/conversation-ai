// A hard-coded seed of the live call's question list, so the analyst console
// renders the full coverage board the instant the room connects — instead of
// sitting on "Waiting for questions…" until the Python agent has cold-started,
// preloaded its Moss indexes, and published its first `coverage_update`.
//
// This MIRRORS agent-py/questions.json (the 9 diligence questions across 3
// pillars the agent actually grades) — same ids, same pillar strings, same
// question text, all `unanswered`. Because the ids match exactly, the first real
// `coverage_update` from the agent REPLACES this seed cleanly (last-wins, no
// flicker, no id collision) and the board starts ticking green as the agent
// scores each answer. The questions are keyed to the Apple Q2 FY26 earnings-call
// Q&A in public/apple-earnings-questions.mp4 — see
// agent-py/demo/apple_call_question_map.md for where each is answered.
//
// Keep this in sync with agent-py/questions.json. The agent remains the source of
// truth at runtime; this is only the pre-connect placeholder.
import type { CoveragePacket } from '@/lib/live/types';

const PILLAR_1 =
  'Supply-gated hardware supercycle: demand is outrunning supply across iPhone and Mac';
const PILLAR_2 =
  'Margin and capital: a memory-cost overhang against a shifting capital-return framework';
const PILLAR_3 = 'The forward call: Services and ads, AI strategy, and the CEO handoff';

export const SEED_COVERAGE: CoveragePacket = {
  company: 'Apple Inc.',
  ticker: 'AAPL',
  thesis:
    'AAPL enters the print mid-supercycle: the iPhone 17 family is driving 20%+ revenue growth while Mac demand runs ahead of supply. Growth is gated by supply (advanced-node SOC availability), not demand. The central risk is the memory-cost overhang building beyond June; Services keeps compounding with advertising as a fresh lever; capital allocation drops the net-cash-neutral target and lifts buyback authorization by $100B; AI pairs a Google partnership with in-house models; and the CEO role hands to John Ternus in September.',
  questions: [
    {
      id: 'q1',
      pillar: PILLAR_1,
      question:
        'How durable is the iPhone 17 cycle — growth, drivers, supply-gated or pull-forward?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'iPhone +22% YoY, record cycle — Q2 FY26 call',
        'Models iPhone +~22%, ASP-led — Vantage note',
      ],
    },
    {
      id: 'q2',
      pillar: PILLAR_1,
      question: 'Where do supply constraints bind, why, and when do they ease — iPhone vs Mac?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Constraint: advanced-node SOC, not memory — Q2 FY26 call',
        'iPhone-led in March → Mac in June — Q2 FY26 call',
      ],
    },
    {
      id: 'q3',
      pillar: PILLAR_1,
      question: 'How broad is Mac demand (Neo, new-to-Mac) and geography (China, India)?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Neo off the charts; record new-to-Mac — Q2 FY26 call',
        'China 1H +33%; India long runway — Q2 FY26 call',
      ],
    },
    {
      id: 'q4',
      pillar: PILLAR_2,
      question: "Where is gross margin, and what's the sequential bridge (mix, tariffs, memory, FX)?",
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'GM 49.3% in March Q — AAPL 10-Q',
        'Products GM −200bps QoQ on memory — Q2 FY26 call',
      ],
    },
    {
      id: 'q5',
      pillar: PILLAR_2,
      question: "What's the memory-cost trajectory past June, how big, and can pricing offset it?",
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Memory rising into June and beyond — Q2 FY26 call',
        'Models ~150-200bps GM headwind — Vantage note',
      ],
    },
    {
      id: 'q6',
      pillar: PILLAR_2,
      question:
        'What does dropping net-cash-neutral and the +$100B buyback signal for capital return?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Net-cash-neutral dropped; +$100B buyback — Q2 FY26 call',
        '>$1T returned, >$850B buybacks — Q2 FY26 call',
      ],
    },
    {
      id: 'q7',
      pillar: PILLAR_3,
      question: 'How durable are Services and the advertising lever (App Store, Maps ads)?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Services GM +20bps; ads up YoY — Q2 FY26 call',
        'Maps ads launch US/Canada this summer — Q2 FY26 call',
      ],
    },
    {
      id: 'q8',
      pillar: PILLAR_3,
      question: "What's the AI strategy (Google vs in-house) and the investment behind it?",
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        "Google + in-house models; 'investing more' — Q2 FY26 call",
        'Search-default payment at antitrust risk — DOJ/Google (NPR)',
      ],
    },
    {
      id: 'q9',
      pillar: PILLAR_3,
      question: 'How clean is the CEO handoff to Ternus — does strategy and discipline carry over?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Ternus CEO in September — Q2 FY26 call',
        'Continuity of strategy + discipline — Q2 FY26 call',
      ],
    },
  ],
  counts: { unanswered: 9, partial: 0, answered: 0 },
  timestamp: 0,
};
