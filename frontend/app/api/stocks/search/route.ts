import { NextResponse } from 'next/server';
import { searchSymbol } from '@/lib/fmp';

// Real ticker autocomplete for the stock selector.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);
  try {
    const hits = await searchSymbol(q);
    // Keep equities on major US exchanges first; FMP returns a mix.
    return NextResponse.json(hits.slice(0, 8));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
