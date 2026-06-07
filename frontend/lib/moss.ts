// Live Moss semantic search for the chat route. The Python agent (DiligenceListener)
// queries Moss through the `moss` SDK, but the SDK's cloud path is a plain JSON POST
// — `POST https://service.usemoss.dev/query` with the project credentials in the body
// — so the Next.js route can hit the same endpoint directly to run a fresh retrieval
// per chat question. Credentials live server-side only (never shipped to the client).
//
// Mirrors agent-py/src/agent.py: same `knowledge` index, same QueryOptions(top_k),
// same _source_label formatting for citations.
import { spawn } from 'node:child_process';
import path from 'node:path';
import 'server-only';

export interface MossDoc {
  id: string;
  text: string;
  metadata?: Record<string, unknown> | null;
  score: number;
}

const QUERY_URL = process.env.MOSS_QUERY_URL || 'https://service.usemoss.dev/query';
const INDEX = process.env.MOSS_INDEX_NAME || 'knowledge';
const TOP_K = Number(process.env.MOSS_TOP_K) || 5;
// agent-py holds the moss SDK + credentials for the on-device fallback.
const AGENT_DIR = process.env.MOSS_AGENT_DIR || path.resolve(process.cwd(), '..', 'agent-py');

/** True when the Moss project credentials are present (else the chat falls back to surfaced context only). */
export function mossConfigured(): boolean {
  return Boolean(process.env.MOSS_PROJECT_ID && process.env.MOSS_PROJECT_KEY);
}

/** Cloud query path — the SDK's documented `POST /query` (credentials in the body). */
async function queryMossCloud(query: string, topK: number): Promise<MossDoc[]> {
  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      indexName: INDEX,
      projectId: process.env.MOSS_PROJECT_ID,
      projectKey: process.env.MOSS_PROJECT_KEY,
      topK,
    }),
  });
  if (!res.ok) throw new Error(`Moss cloud query HTTP ${res.status}`);
  const data = (await res.json()) as { docs?: MossDoc[] };
  return Array.isArray(data.docs) ? data.docs : [];
}

/**
 * On-device fallback — shells out to agent-py/src/moss_query.py (the same MossClient
 * path the live agent uses). Used when the cloud query service is unavailable. Never
 * throws: returns [] on any failure so the chat degrades to surfaced context.
 */
function queryMossLocal(query: string, topK: number): Promise<MossDoc[]> {
  return new Promise((resolve) => {
    const child = spawn('uv', ['--directory', AGENT_DIR, 'run', 'python', 'src/moss_query.py'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 25_000);
    child.stdout.on('data', (d) => (out += d));
    child.on('error', () => {
      clearTimeout(timer);
      resolve([]);
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const s = out.indexOf('{');
        const e = out.lastIndexOf('}');
        if (s === -1 || e === -1) return resolve([]);
        const parsed = JSON.parse(out.slice(s, e + 1)) as { docs?: MossDoc[] };
        resolve(Array.isArray(parsed.docs) ? parsed.docs : []);
      } catch {
        resolve([]);
      }
    });
    child.stdin.write(JSON.stringify({ query, topK, index: INDEX }));
    child.stdin.end();
  });
}

/**
 * Semantic search against the Moss `knowledge` index (the static RAG corpus of the
 * company's filings + analyst notes). Prefers the cloud HTTP path; if that service is
 * down, falls back to the on-device SDK. Returns [] if unconfigured / empty query.
 */
export async function queryMoss(query: string, topK = TOP_K): Promise<MossDoc[]> {
  const q = query.trim();
  if (!mossConfigured() || !q) return [];
  try {
    return await queryMossCloud(q, topK);
  } catch {
    return await queryMossLocal(q, topK);
  }
}

/** Compact human source cite for a Moss snippet — mirrors agent.py `_source_label`. */
function sourceLabel(meta: Record<string, unknown> | null | undefined): string {
  if (!meta || typeof meta !== 'object') return '';
  const s = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string).trim() : '');
  const docType = s('doc_type');
  const ticker = s('ticker');
  const pages = s('pages');
  const source = s('source');
  if (docType === '10-K' || docType === '10-Q') {
    const label = [ticker, docType].filter(Boolean).join(' ');
    return pages ? `${label} p.${pages}` : label;
  }
  return source || docType || ticker;
}

/** Render Moss docs as a labeled, bounded context block for the chat system prompt. */
export function formatMossDocs(docs: MossDoc[]): string {
  return docs
    .map((d) => {
      const label = sourceLabel(d.metadata) || 'corpus';
      const score = typeof d.score === 'number' ? ` ${d.score.toFixed(2)}` : '';
      const text = (d.text || '').trim().replace(/\s+/g, ' ').slice(0, 700);
      return `  - [${label}${score}] ${text}`;
    })
    .join('\n');
}
