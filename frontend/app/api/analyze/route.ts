import { NextResponse } from 'next/server';
import { analyzeSymbol } from '@/lib/analyze';

export const maxDuration = 180;

// Real engine: pull the company's latest earnings transcript + consensus and
// have Claude produce the structured diligence session the console replays.
export async function POST(req: Request) {
  let symbol: string | undefined;
  try {
    const body = (await req.json()) as { symbol?: string };
    symbol = body.symbol;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 });

  try {
    const session = await analyzeSymbol(symbol);
    return NextResponse.json(session);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
