// The real analysis engine. Pulls a company's actual latest earnings
// transcript + real consensus estimates from FMP, then has Claude produce the
// structured coverage / grounding / divergence session the console replays.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import 'server-only';
import { type Estimate, getEstimates, getLatestTranscript, getProfile } from '@/lib/fmp';
import type { CoverageState, Pillar, Session, SessionMeta, SessionTurn } from '@/lib/session';

function fmtUSD(n: number): string {
  if (!n) return 'n/a';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function consensusBlock(estimates: Estimate[]): string {
  if (!estimates?.length) return 'No analyst consensus available.';
  return estimates
    .slice(0, 3)
    .map((e) => {
      const yr = e.date?.slice(0, 4) ?? '?';
      return `FY${yr}: revenue avg ${fmtUSD(e.revenueAvg)}, EPS avg ${e.epsAvg?.toFixed(2)}, EBITDA avg ${fmtUSD(e.ebitdaAvg)} (${e.numAnalystsRevenue ?? '?'} analysts)`;
    })
    .join('\n');
}

const SYSTEM = `You are a real-time diligence copilot for a BUY-SIDE hedge fund analyst listening to a company's earnings call. You track which diligence questions the call answers, ground management's claims against the real consensus, flag divergences, and note thesis updates. You never trade and never speak on the call. Output ONLY a single JSON object, no prose, no markdown fences.`;

function userPrompt(args: {
  name: string;
  symbol: string;
  sector: string;
  industry: string;
  period: string;
  consensus: string;
  transcript: string;
}): string {
  return `COMPANY: ${args.name} (${args.symbol}) — ${args.sector} / ${args.industry}
CALL: ${args.period} earnings call

REAL ANALYST CONSENSUS (ground divergence flags against this):
${args.consensus}

EARNINGS CALL TRANSCRIPT (real):
"""
${args.transcript}
"""

Produce the diligence session as JSON with EXACTLY this shape:
{
  "thesis": "<one plain-English sentence: the buy-side thesis on this name>",
  "pillars": [ { "id": "P1", "thesis": "<short thesis leg>", "questions": ["Q1","Q2"] } ],
  "questions": [ { "id": "Q1", "text": "<sharp buy-side diligence question>", "topic": "<2-4 words>" } ],
  "turns": [
    {
      "t": 1,
      "speaker": "<who, e.g. 'CEO — Brett Schulman' or 'Analyst — Morgan Stanley'>",
      "role": "subject",
      "text": "<tight quote or paraphrase, <= 240 chars>",
      "expected": {
        "addresses": ["Q2"],
        "coverage": { "Q2": "partial" },
        "extracted_facts": ["<real number/fact stated>"],
        "contradiction": null,
        "followup": null,
        "thesis_delta": null
      }
    }
  ],
  "final_coverage": { "Q1": "answered" },
  "thesis_delta": { "summary": "<2 plain sentences>", "changes": [ { "field": "<assumption>", "from": "<prior>", "to": "<new>" } ], "net": "<one plain sentence: add / trim / hold / re-underwrite>" }
}

HARD RULES:
- EXACTLY 6 questions covering: growth, margins, guidance vs consensus, demand/end-markets, competitive position, and the single biggest risk.
- 3 or 4 pillars; every question belongs to exactly one pillar.
- 10 to 12 turns, chronological. Cover prepared remarks AND key Q&A.
- Every "coverage" value and every "final_coverage" value MUST be EXACTLY one of: "unanswered", "partial", "answered". Never any other word.
- "contradiction" is null OR { "vs": "consensus"|"guidance"|"note", "detail": "<specific, with numbers>" }.
- Provide a "followup" string whenever coverage is "partial". At least one partial+followup. Flag a real divergence vs consensus if one exists; do not invent one.
- All free text (thesis, details, net, summary) must be normal English sentences with spaces — never snake_case or underscores.
- Output ONLY the JSON object.`;
}

interface ModelSession {
  thesis?: string;
  pillars?: Pillar[];
  questions?: Session['questions'];
  turns?: SessionTurn[];
  final_coverage?: Record<string, string>;
  thesis_delta?: Session['thesis_delta'];
}

function extractJson(text: string): ModelSession {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model response');
  return JSON.parse(text.slice(start, end + 1)) as ModelSession;
}

// ---- Normalization (the model, esp. haiku, drifts on enums/formatting) ----

function clean(s: unknown): string {
  if (typeof s !== 'string') return '';
  // Undo snake_case run-ons, collapse whitespace.
  return s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function normState(v: unknown): CoverageState {
  const s = String(v ?? '').toLowerCase();
  if (s.startsWith('answer') || s === 'covered' || s === 'complete' || s === 'completed')
    return 'answered';
  if (s === 'partial' || s === 'thin' || s.startsWith('partly')) return 'partial';
  return 'unanswered';
}

function normCoverage(c: unknown): Record<string, CoverageState> {
  const out: Record<string, CoverageState> = {};
  if (c && typeof c === 'object') {
    for (const [k, v] of Object.entries(c as Record<string, unknown>)) out[k] = normState(v);
  }
  return out;
}

function callClaude(system: string, user: string): Promise<string> {
  const model = process.env.ANALYSIS_MODEL_ALIAS || 'haiku';
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      ['-p', '--model', model, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'],
      { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpdir() }
    );
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('claude analysis timed out'));
    }, 110_000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude exited ${code}: ${err.slice(0, 200)}`));
    });
    child.stdin.write(`${system}\n\n${user}`);
    child.stdin.end();
  });
}

// Simple per-process cache so re-opening a ticker is instant.
const cache = new Map<string, Session>();

export async function analyzeSymbol(symbolRaw: string): Promise<Session> {
  const symbol = symbolRaw.trim().toUpperCase();
  const cached = cache.get(symbol);
  if (cached) return cached;

  const [profile, estimates, latest] = await Promise.all([
    getProfile(symbol),
    getEstimates(symbol).catch(() => [] as Estimate[]),
    getLatestTranscript(symbol),
  ]);
  if (!profile) throw new Error(`No profile found for ${symbol}`);
  if (!latest) throw new Error(`No earnings transcript available for ${symbol}`);

  const period = `Q${latest.date.quarter} FY${latest.date.fiscalYear}`;
  const transcript = latest.transcript.content.slice(0, 24000);

  const raw = await callClaude(
    SYSTEM,
    userPrompt({
      name: profile.companyName,
      symbol,
      sector: profile.sector,
      industry: profile.industry,
      period,
      consensus: consensusBlock(estimates),
      transcript,
    })
  );
  const m = extractJson(raw);

  const meta: SessionMeta = {
    symbol,
    companyName: profile.companyName,
    exchange: profile.exchangeFullName || profile.exchange || '',
    sector: profile.sector,
    industry: profile.industry,
    price: profile.price,
    marketCap: profile.marketCap,
    period,
    date: latest.date.date,
    thesis: clean(m.thesis),
    source: 'real-earnings',
    callKind: 'Earnings call',
  };

  const turns: SessionTurn[] = (m.turns ?? []).map((t, i) => {
    const exp = t.expected;
    return {
      t: t.t ?? i + 1,
      speaker: t.speaker || 'Management',
      role: 'subject',
      text: clean(t.text),
      expected: exp
        ? {
            addresses: Array.isArray(exp.addresses) ? exp.addresses : [],
            coverage: normCoverage(exp.coverage),
            extracted_facts: Array.isArray(exp.extracted_facts)
              ? exp.extracted_facts.map(clean)
              : [],
            contradiction: exp.contradiction
              ? {
                  vs: clean(exp.contradiction.vs) || 'consensus',
                  detail: clean(exp.contradiction.detail),
                }
              : null,
            followup: exp.followup ? clean(exp.followup) : null,
            thesis_delta: exp.thesis_delta ? clean(exp.thesis_delta) : null,
          }
        : undefined,
    };
  });

  const session: Session = {
    meta,
    pillars: Array.isArray(m.pillars) ? m.pillars : undefined,
    questions: (m.questions ?? []).map((q) => ({
      id: q.id,
      text: clean(q.text),
      topic: q.topic,
    })),
    turns,
    final_coverage: normCoverage(m.final_coverage),
    thesis_delta: {
      summary: clean(m.thesis_delta?.summary),
      changes: (m.thesis_delta?.changes ?? []).map((c) => ({
        field: clean(c.field),
        from: clean(c.from),
        to: clean(c.to),
        source_turn: 0,
      })),
      net: clean(m.thesis_delta?.net),
    },
  };

  cache.set(symbol, session);
  return session;
}
