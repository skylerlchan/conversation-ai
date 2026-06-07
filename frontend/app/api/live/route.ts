import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory live snapshot for the demo (single dev process). The live-call
// runner (agent-py/demo/run_live_call.py) POSTs the coverage snapshot here as it
// streams the call audio through STT + the coverage engine; /live polls GET.
// Reliable, zero-setup transport for the stage demo. The LiveKit data-packet
// path (agent.py → useLiveCoverage) remains the production architecture.
let snapshot: unknown = null;

export async function POST(req: Request) {
  try {
    snapshot = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
