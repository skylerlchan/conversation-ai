// Server-only Financial Modeling Prep client. The API key never leaves the
// server (read from FMP_API_KEY). All financial data in the app is real.
import 'server-only';

const BASE = 'https://financialmodelingprep.com/stable';

function key(): string {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error('FMP_API_KEY is not set');
  return k;
}

async function fmp<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('apikey', key());
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FMP ${path} ${res.status}`);
  return (await res.json()) as T;
}

export interface SymbolHit {
  symbol: string;
  name: string;
  exchange: string;
  exchangeFullName: string;
  currency: string;
}

export interface Profile {
  symbol: string;
  companyName: string;
  price: number;
  marketCap: number;
  sector: string;
  industry: string;
  range: string;
  description: string;
  ceo: string;
  beta: number;
  exchangeFullName?: string;
  exchange?: string;
}

export interface Estimate {
  date: string;
  revenueAvg: number;
  revenueLow: number;
  revenueHigh: number;
  ebitdaAvg: number;
  netIncomeAvg: number;
  epsAvg: number;
  epsLow: number;
  epsHigh: number;
  numAnalystsRevenue: number;
  numAnalystsEps: number;
}

export interface TranscriptDate {
  quarter: number;
  fiscalYear: number;
  date: string;
}

export interface Transcript {
  symbol: string;
  period: string;
  year: number;
  date: string;
  content: string;
}

export function searchSymbol(query: string) {
  return fmp<SymbolHit[]>('search-symbol', { query, limit: 8 });
}

export async function getProfile(symbol: string): Promise<Profile | null> {
  const rows = await fmp<Profile[]>('profile', { symbol });
  return rows[0] ?? null;
}

export function getEstimates(symbol: string, limit = 3) {
  return fmp<Estimate[]>('analyst-estimates', { symbol, period: 'annual', page: 0, limit });
}

export function getTranscriptDates(symbol: string) {
  return fmp<TranscriptDate[]>('earning-call-transcript-dates', { symbol });
}

export async function getTranscript(
  symbol: string,
  year: number,
  quarter: number
): Promise<Transcript | null> {
  const rows = await fmp<Transcript[]>('earning-call-transcript', { symbol, year, quarter });
  const row = Array.isArray(rows) ? rows[0] : (rows as Transcript);
  return row && row.content ? row : null;
}

/** Latest available transcript for a symbol (most recent quarter). */
export async function getLatestTranscript(
  symbol: string
): Promise<{ transcript: Transcript; date: TranscriptDate } | null> {
  const dates = await getTranscriptDates(symbol);
  if (!dates?.length) return null;
  const latest = dates[0];
  const transcript = await getTranscript(symbol, latest.fiscalYear, latest.quarter);
  return transcript ? { transcript, date: latest } : null;
}
