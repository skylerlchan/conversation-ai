// The curated CAVA diligence call, expressed as a Session so the console can
// render it through the same path as a live-analyzed ticker.
import type { Session, SessionTurn } from '@/lib/session';
import { callFixture, questionsFixture } from './index';

const turns: SessionTurn[] = callFixture.turns.map((t) => ({
  t: t.t,
  speaker: t.speaker === 'analyst' ? 'You (buy-side)' : 'Researcher',
  role: t.speaker === 'analyst' ? 'self' : 'subject',
  text: t.text,
  asks: t.asks,
  is_followup: Boolean(t.is_followup_for),
  prompted_by_copilot: t.prompted_by_copilot,
  expected: t.expected,
  copilot_surfaced: t.copilot_surfaced,
}));

export const demoSession: Session = {
  meta: {
    symbol: questionsFixture.company.ticker,
    companyName: questionsFixture.company.name,
    exchange: questionsFixture.company.exchange,
    sector: questionsFixture.company.sector,
    industry: '',
    price: 0,
    marketCap: 0,
    period: '',
    date: '',
    thesis: questionsFixture.thesis,
    source: 'scripted',
    callKind: 'Diligence call · sell-side',
  },
  pillars: questionsFixture.pillars,
  questions: questionsFixture.questions.map((q) => ({ id: q.id, text: q.text })),
  turns,
  final_coverage: callFixture.final_coverage,
  thesis_delta: callFixture.thesis_delta,
};
