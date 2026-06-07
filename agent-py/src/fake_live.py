"""Fake-live driver — replay a scripted diligence call into a LiveKit room.

This publishes the same `transcript` / `coverage_update` data packets the real
`DiligenceListener` emits, but sourced from a scripted fixture instead of live
STT + the coverage LLM. Two jobs:

  1. Integration harness + stage fallback: drive the live console
     (/console/live) end to end with zero audio, STT, Moss, or LLM variance.
  2. Engine-machinery check: each researcher turn's scripted `expected` verdict is
     folded through the SAME `apply_verdict` the live engine uses, so the coverage
     arc emerges from the state machine, not from hand-authored snapshots
     (docs/diligence-copilot-build-plan.md, Phase 2.1).

`build_packets()` is pure (no LiveKit, no network) so it can be unit-tested and
dry-run. `main()` adds the room connection + timed publish loop.

Run:  uv run src/fake_live.py --room <name> [--speed 2.6] [--dry-run]
"""

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from coverage import CallState, QuestionUpdate, TurnVerdict, apply_verdict

load_dotenv(".env.local")

AGENT_ROOT = Path(__file__).resolve().parent.parent
DEMO_DIR = AGENT_ROOT / "demo"
# The live question list (CallState format, with inline pillars) so the replayed
# coverage_update cards carry pillars just like the live agent's.
DEFAULT_QUESTIONS = AGENT_ROOT / "questions.json"
DEFAULT_CALL = DEMO_DIR / "cmg_call.json"
DEFAULT_SPEED_S = 2.6


def _contradiction_str(c) -> str:
    """The demo fixture's contradiction is null | {vs, detail}; the engine wants a string."""
    if not c:
        return ""
    if isinstance(c, dict):
        return c.get("detail", "")
    return str(c)


def _verdict_from_expected(expected: dict) -> TurnVerdict:
    """Convert a fixture turn's `expected` block into the engine's TurnVerdict.

    The primary (first addressed) question carries the facts / contradiction /
    follow-up; co-addressed questions just get their coverage state.
    """
    coverage = expected.get("coverage", {}) or {}
    addresses = expected.get("addresses") or list(coverage.keys())
    primary = addresses[0] if addresses else None

    updates: list[QuestionUpdate] = []
    for qid, state in coverage.items():
        is_primary = qid == primary
        updates.append(
            QuestionUpdate(
                question_id=qid,
                coverage=state,
                extracted_facts=list(expected.get("extracted_facts", [])) if is_primary else [],
                contradiction=_contradiction_str(expected.get("contradiction")) if is_primary else "",
                followup=(expected.get("followup") or "") if is_primary else "",
            )
        )
    return TurnVerdict(updates=updates)


def build_packets(questions: dict, call: dict) -> list[dict]:
    """Replay the scripted call into the ordered list of {type, data} packets.

    Mirrors the live agent: an initial coverage snapshot, a transcript packet per
    turn, and a fresh coverage snapshot after each researcher turn that carries a
    verdict (folded through `apply_verdict`).
    """
    state = CallState.from_dict(questions)
    packets: list[dict] = [{"type": "coverage_update", "data": state.snapshot()}]

    for turn in sorted(call.get("turns", []), key=lambda t: t.get("t", 0)):
        data = {"t": turn["t"], "speaker": turn["speaker"], "text": turn["text"]}
        if turn.get("prompted_by_copilot"):
            data["prompted_by_copilot"] = turn["prompted_by_copilot"]
        packets.append({"type": "transcript", "data": data})

        expected = turn.get("expected")
        if turn.get("speaker") == "researcher" and expected:
            apply_verdict(state, _verdict_from_expected(expected))
            packets.append({"type": "coverage_update", "data": state.snapshot()})

    return packets


def _load(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Replay a scripted diligence call into a LiveKit room.")
    parser.add_argument("--room", default=os.getenv("FAKE_LIVE_ROOM", "diligence-demo"))
    parser.add_argument("--questions", default=str(DEFAULT_QUESTIONS))
    parser.add_argument("--call", default=str(DEFAULT_CALL))
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED_S, help="seconds between turns")
    parser.add_argument("--identity", default="fake-researcher")
    parser.add_argument("--dry-run", action="store_true", help="print packets instead of publishing")
    args = parser.parse_args()

    packets = build_packets(_load(Path(args.questions)), _load(Path(args.call)))

    if args.dry_run:
        for p in packets:
            print(json.dumps(p))
        print(f"\n{len(packets)} packets ({sum(1 for p in packets if p['type'] == 'transcript')} turns)")
        return

    # LiveKit is imported lazily so build_packets/tests need no SDK or creds.
    from livekit import api, rtc

    url = os.environ["LIVEKIT_URL"]
    token = (
        api.AccessToken(os.environ["LIVEKIT_API_KEY"], os.environ["LIVEKIT_API_SECRET"])
        .with_identity(args.identity)
        .with_name("Scripted researcher")
        .with_grants(api.VideoGrants(room_join=True, room=args.room))
        .to_jwt()
    )

    room = rtc.Room()
    await room.connect(url, token)
    print(f"connected to room '{args.room}' as '{args.identity}'")

    try:
        for p in packets:
            payload = {
                "type": p["type"],
                "data": {**p["data"], "timestamp": datetime.now(timezone.utc).timestamp()},
            }
            await room.local_participant.publish_data(
                json.dumps(payload).encode("utf-8"), reliable=True
            )
            # Pace by turn: pause after each transcript packet (its coverage update
            # rides immediately behind it).
            if p["type"] == "transcript":
                await asyncio.sleep(args.speed)
        print("replay complete")
        # Hold the connection briefly so the last packets flush before disconnect.
        await asyncio.sleep(2.0)
    finally:
        await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
