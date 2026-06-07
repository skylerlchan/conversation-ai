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
  'Supply-gated hardware supercycle: iPhone and Mac demand is outrunning supply, with broad geographic strength';
const PILLAR_2 =
  'Margin and capital: the memory-cost overhang on gross margin against a shift in the capital-return framework';
const PILLAR_3 =
  'The forward call: high-margin Services and advertising, an in-house-plus-Google AI strategy, and the CEO handoff to John Ternus';

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
        'How strong and durable is the iPhone 17 cycle — the growth rate, its drivers, and is it supply-gated demand rather than a pull-forward?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'iPhone +22% YoY, strongest cycle in company history — Q2 FY26 call',
        'Driven by the iPhone 17 family; double-digit growth across most tracked markets — Q2 FY26 call',
        'New March-quarter record for upgraders; ~99% US satisfaction — Q2 FY26 call',
        'Base case models iPhone +~22%, ASP/mix-led off the 17 Pro/Air — Vantage note',
      ],
    },
    {
      id: 'q2',
      pillar: PILLAR_1,
      question:
        'Where do the supply constraints bind, what is the root cause, and when do they ease — iPhone versus Mac?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Binding constraint is advanced-node SOC availability, not memory — Q2 FY26 call',
        'March quarter constrained primarily on iPhone, less on Mac — Q2 FY26 call',
        'June-quarter constraint shifts to Mac (mini, Studio, Neo); mini/Studio several months to rebalance — Q2 FY26 call',
      ],
    },
    {
      id: 'q3',
      pillar: PILLAR_1,
      question:
        'How broad is demand across the Mac line (MacBook Neo, new-to-Mac) and geographically (Greater China, India)?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'MacBook Neo off the charts; March-quarter record for customers new to Mac — Q2 FY26 call',
        'Greater China first half +33%, March-Q revenue +28% (a quarterly record) — Q2 FY26 call',
        'India the #2 smartphone / #3 PC market at still-modest share — Q2 FY26 call',
      ],
    },
    {
      id: 'q4',
      pillar: PILLAR_2,
      question:
        'Where is gross margin running and what is the sequential bridge (mix, tariffs, memory, deleverage, FX)?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'March-quarter company gross margin 49.3% — AAPL 10-Q',
        'Products GM −200bps sequentially on seasonal deleverage + memory — Q2 FY26 call',
        'Overall GM +110bps sequentially on favorable mix + lower tariffs; FX neutral — Q2 FY26 call',
        'Tariff relief from IEEPA + Section 122; refunds to be reinvested in US — Q2 FY26 call',
      ],
    },
    {
      id: 'q5',
      pillar: PILLAR_2,
      question:
        'What is the memory-cost trajectory beyond June, how big is the headwind, and can pricing offset it?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Memory minimal in Dec Q, higher in March (offset by inventory) — Q2 FY26 call',
        'Significantly higher in the June guide, with increasing impact beyond — Q2 FY26 call',
        "Management will weigh a 'range of options' — Q2 FY26 call",
        'We model a ~150-200bps GM headwind, <half passed through on price — Vantage note',
      ],
    },
    {
      id: 'q6',
      pillar: PILLAR_2,
      question:
        'What does dropping the net-cash-neutral target and the $100B buyback increase signal for capital return?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Net-cash-neutral retired as a formal target; cash and debt evaluated independently — Q2 FY26 call',
        '+$100B buyback authorization on top of leftover capacity — Q2 FY26 call',
        'Over $1T returned to date, >$850B via buybacks — Q2 FY26 call',
      ],
    },
    {
      id: 'q7',
      pillar: PILLAR_3,
      question:
        'How durable are Services and the advertising lever — services margin, App Store ads, and Apple Maps ads?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Services gross margin +20bps sequentially, primarily mix — Q2 FY26 call',
        'Advertising up YoY with new App Store search-results inventory — Q2 FY26 call',
        'Apple Maps ads launching in US and Canada this summer — Q2 FY26 call',
      ],
    },
    {
      id: 'q8',
      pillar: PILLAR_3,
      question:
        "What is Apple's AI / foundational-model strategy (Google vs in-house) and the investment behind it?",
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'Two-pronged: Google collaboration plus in-house foundational models — Q2 FY26 call',
        "'Investing more'; R&D accelerating faster than the company overall — Q2 FY26 call",
        'Google search-default payment sits at antitrust risk under the DOJ remedy — DOJ/Google (NPR)',
      ],
    },
    {
      id: 'q9',
      pillar: PILLAR_3,
      question:
        'How clean is the CEO transition to John Ternus, and does strategy and capital discipline carry over?',
      state: 'unanswered',
      facts: [],
      contradictions: [],
      followup: null,
      notes: [
        'John Ternus transitions into the CEO role in September — Q2 FY26 call',
        'Tim Cook has about one more earnings call — Q2 FY26 call',
        'Messaging stresses continuity of strategy and financial discipline — Q2 FY26 call',
      ],
    },
  ],
  counts: { unanswered: 9, partial: 0, answered: 0 },
  timestamp: 0,
};
