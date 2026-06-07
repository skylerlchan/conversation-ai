// The real analysis engine. Pulls a company's actual latest earnings
// transcript + real consensus estimates from FMP, then has Claude produce the
// structured coverage / grounding / divergence session the console replays.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import 'server-only';
import { type Estimate, getEstimates, getLatestTranscript, getProfile } from '@/lib/fmp';
import type { Session, SessionMeta } from '@/lib/session';

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
      return `FY${yr}: revenue avg ${fmtUSD(e.revenueAvg)} (range ${fmtUSD(e.revenueLow)}–${fmtUSD(
        e.revenueHigh
      )}), EPS avg ${e.epsAvg?.toFixed(2)} (range ${e.epsLow?.toFixed(2)}–${e.epsHigh?.toFixed(
        2
      )}), EBITDA avg ${fmtUSD(e.ebitdaAvg)} — ${e.numAnalystsRevenue ?? '?'} analysts`;
    })
    .join('\n');
}

const SYSTEM = `You are a real-time diligence copilot for a BUY-SIDE hedge fund analyst who is listening to a company's earnings call. Your job is to make sure the analyst leaves the call with every diligence question covered: you track which questions the call has answered, ground management's claims against the company's real consensus estimates and prior guidance, flag where what is said diverges from consensus, and note what the analyst should update in their thesis. You never trade and never speak on the call — you surface; the human decides.

You output ONLY a single JSON object, no prose, no markdown fences.`;

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

REAL ANALYST CONSENSUS (from FMP, ground your divergence flags against this):
${args.consensus}

EARNINGS CALL TRANSCRIPT (real):
"""
${args.transcript}
"""

TASK — produce the diligence session as JSON with this exact shape:
{
  "thesis": "<one sentence: the buy-side thesis a fund would hold on this name>",
  "questions": [ { "id": "Q1", "text": "<a sharp buy-side diligence question for THIS company/sector>", "topic": "<2-4 word topic>" } ],   // 6-8 questions: unit/revenue growth, margins, guidance vs consensus, demand/end-markets, competitive position, capital allocation, and the single biggest risk for this name
  "turns": [
    {
      "t": 1,
      "speaker": "<who is talking, e.g. 'CEO — <name>' or 'Analyst — <bank>'>",
      "role": "subject",
      "text": "<a tight quote or close paraphrase of what they said, <= 280 chars>",
      "expected": {
        "addresses": ["Q2"],                         // which question(s) this turn speaks to (may be [])
        "coverage": { "Q2": "partial" },              // unanswered | partial | answered — states only move FORWARD
        "extracted_facts": ["<real fact/number stated>"],
        "contradiction": null,                        // or { "vs": "consensus" | "guidance", "detail": "<what was said vs the real consensus/prior guidance — be specific with numbers>" }
        "followup": null,                             // or "<the gap to probe with IR / the sharper question — grounded in a specific number>" when coverage is 'partial'
        "thesis_delta": null                          // or "<what the analyst should update>" when an answer moves an assumption
      },
      "copilot_surfaced": "<one short line describing what the copilot put on screen for this turn>"
    }
  ],
  "final_coverage": { "Q1": "answered", "...": "..." },   // every question's end state; questions the call never addressed stay "unanswered"
  "thesis_delta": {
    "summary": "<2 sentences: net read after the call>",
    "changes": [ { "field": "<assumption>", "from": "<prior>", "to": "<new>" } ],   // 2-5 concrete assumption moves
    "net": "<one line: what to do — add, trim, hold, re-underwrite>"
  }
}

RULES:
- 12 to 18 turns, in chronological call order. Cover the prepared-remarks highlights AND the key Q&A exchanges.
- Be specific and numeric. Ground every contradiction flag against the real consensus above or against prior guidance stated on the call. Do not invent numbers not supported by the transcript or consensus.
- At least one 'partial' with a real grounded follow-up, and flag any genuine divergence from consensus. If there is genuinely none, do not fabricate one.
- coverage states only move forward (unanswered -> partial -> answered).
- Output ONLY the JSON object.`;
}

interface ModelSession {
  thesis: string;
  questions: Session['questions'];
  turns: Session['turns'];
  final_coverage: Session['final_coverage'];
  thesis_delta: Session['thesis_delta'];
}

function extractJson(text: string): ModelSession {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model response');
  return JSON.parse(text.slice(start, end + 1)) as ModelSession;
}

// Runs the analysis through the Claude Agent SDK CLI (`claude -p`), which
// carries the harness's working auth — no raw API key plumbing. The prompt is
// piped via stdin to avoid arg-size limits. To move to a hosted endpoint later
// (e.g. a sponsor MiniMax / Bedrock key), swap this one function.
function callClaude(system: string, user: string): Promise<string> {
  const model = process.env.ANALYSIS_MODEL_ALIAS || 'sonnet';
  return new Promise((resolve, reject) => {
    // Disable project MCP servers (they hang headless startup) and run in a
    // neutral cwd so no project config/tools load — this is a pure completion.
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
    }, 175_000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`));
    });
    child.stdin.write(`${system}\n\n${user}`);
    child.stdin.end();
  });
}

export async function analyzeSymbol(symbolRaw: string): Promise<Session> {
  const symbol = symbolRaw.trim().toUpperCase();
  const [profile, estimates, latest] = await Promise.all([
    getProfile(symbol),
    getEstimates(symbol).catch(() => [] as Estimate[]),
    getLatestTranscript(symbol),
  ]);
  if (!profile) throw new Error(`No profile found for ${symbol}`);
  if (!latest) throw new Error(`No earnings transcript available for ${symbol}`);

  const period = `Q${latest.date.quarter} FY${latest.date.fiscalYear}`;
  const transcript = latest.transcript.content.slice(0, 52000);

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
  const model = extractJson(raw);

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
    thesis: model.thesis,
    source: 'real-earnings',
    callKind: 'Earnings call',
  };

  // Normalize roles (the model is told everything is 'subject' on an earnings call).
  const turns = (model.turns ?? []).map((t, i) => ({
    ...t,
    t: t.t ?? i + 1,
    role: 'subject' as const,
  }));

  return {
    meta,
    questions: model.questions ?? [],
    turns,
    final_coverage: model.final_coverage ?? {},
    thesis_delta: model.thesis_delta ?? { summary: '', changes: [], net: '' },
  };
}
