"""Build the real-call demo: real STT + the real coverage engine, time-synced.

Pretends a real earnings-call recording is the expert on a buy-side diligence
call. Takes a Whisper transcription of the recording (clean, full-utterance, with
segment timestamps), groups it into turns, and runs each turn through the SAME
coverage engine the live agent uses (engine.grade_turn -> apply_verdict). The
output is a time-synced packet timeline: a `transcript` packet at each turn's
start and a `coverage_update` snapshot at its end. The frontend plays the real
audio and emits these packets against the audio clock, so the analyst console
shows real transcription streaming and the questions ticking on real verdicts —
no mic, no TTS, reliable on stage.

Pipeline:
  1) curl Whisper -> demo/realaudio/reel_transcript.json  (verbose_json, segments)
  2) uv run src/build_realcall.py                          (this script)

Outputs frontend/public/demo/realcall/{call.mp3,timeline.json}.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel

from coverage import ANSWERED, CallState, apply_verdict
from engine import grade_turn

load_dotenv(".env.local")

from livekit.agents import inference  # noqa: E402  (after load_dotenv, like agent.py)
from livekit.agents.llm import ChatContext  # noqa: E402

SRC = Path(__file__).resolve().parent
AGENT_ROOT = SRC.parent
DEMO = AGENT_ROOT / "demo"
QUESTIONS = AGENT_ROOT / "questions.json"
TRANSCRIPT = DEMO / "realaudio" / "reel_transcript.json"
AUDIO_SRC = DEMO / "realaudio" / "reel.mp3"
OUT_DIR = AGENT_ROOT.parent / "frontend" / "public" / "demo" / "realcall"

# Merge Whisper's short segments into short, sentence-sized turns so the
# transcript streams frequently (feels live) in a ~1-minute clip. The closeout
# pass greens a question from accumulated facts, so turns needn't be large.
MIN_TURN_CHARS = 90
MAX_TURN_SECONDS = 9.0


def load_segments() -> list[dict]:
    data = json.loads(TRANSCRIPT.read_text(encoding="utf-8"))
    segs = data.get("segments") or []
    return [
        {"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip()}
        for s in segs
        if s.get("text", "").strip()
    ]


def group_turns(segments: list[dict]) -> list[dict]:
    """Merge consecutive segments into turns (~a couple sentences each)."""
    turns: list[dict] = []
    cur: dict | None = None
    for s in segments:
        if cur is None:
            cur = {"start": s["start"], "end": s["end"], "text": s["text"]}
            continue
        long_enough = len(cur["text"]) >= MIN_TURN_CHARS and cur["text"].rstrip().endswith((".", "?", "!"))
        too_long = (s["end"] - cur["start"]) > MAX_TURN_SECONDS
        if long_enough or too_long:
            turns.append(cur)
            cur = {"start": s["start"], "end": s["end"], "text": s["text"]}
        else:
            cur["end"] = s["end"]
            cur["text"] = f"{cur['text']} {s['text']}".strip()
    if cur is not None:
        turns.append(cur)
    return turns


class CloseoutDecision(BaseModel):
    """Whether the real call, in aggregate, satisfied a question's criteria."""

    answered: bool
    why: str


async def closeout(llm: inference.LLM, question, facts: list[str]) -> CloseoutDecision:
    """Decide if the accumulated real facts satisfy ALL of a question's criteria.

    The per-turn engine is conservative and grades one turn in isolation, so it
    rarely emits ``answered``. This mirrors how an analyst actually concludes a
    question is covered: after hearing the whole answer, check the gathered facts
    against the complete_when criteria. Honest — it only reads real extracted facts.
    """
    criteria = "\n".join(f"- {c}" for c in question.complete_when) or "- (none)"
    factlist = "\n".join(f"- {f}" for f in facts) or "- (none)"
    system = (
        "You decide whether a diligence question is fully covered. Given the "
        "criteria a complete answer must satisfy and the concrete facts the expert "
        "actually stated across the call, return answered=true ONLY if the facts "
        "together satisfy EVERY criterion; otherwise answered=false. Judge the facts "
        "as a whole (they were stated across the call), not one at a time."
    )
    user = f"QUESTION: {question.question}\n\nCRITERIA:\n{criteria}\n\nFACTS STATED:\n{factlist}"
    ctx = ChatContext.empty()
    ctx.add_message(role="system", content=system)
    ctx.add_message(role="user", content=user)
    stream = llm.chat(chat_ctx=ctx, response_format=CloseoutDecision)
    response = await stream.collect()
    return CloseoutDecision.model_validate_json(response.text)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Build the synced real-call timeline.")
    parser.add_argument("--questions", default=str(QUESTIONS), help="question list to grade against")
    args = parser.parse_args()

    call = CallState.from_file(args.questions)
    segments = load_segments()
    turns = group_turns(segments)
    print(f"{len(segments)} segments -> {len(turns)} turns")

    llm = inference.LLM(model="openai/gpt-4.1-mini")

    # Phase 1 — grade each turn through the real engine, accumulating facts. Record
    # a coverage snapshot at each turn's end + the end-time of the last turn that
    # advanced each question (when its answer "completed").
    transcript_packets: list[dict] = []
    history: list[tuple[float, dict]] = []
    answered_at: dict[str, float] = {}  # question id -> end time it first satisfied all criteria
    for i, turn in enumerate(turns, start=1):
        transcript_packets.append(
            {
                "at": round(turn["start"], 2),
                "type": "transcript",
                "data": {"t": i, "speaker": "researcher", "text": turn["text"]},
            }
        )
        try:
            verdict = await grade_turn(llm, call, turn["text"])
            changed = apply_verdict(call, verdict)
        except Exception as exc:  # noqa: BLE001 — never let one turn kill the build
            print(f"  turn {i:>2}: grade failed ({exc}); skipping verdict")
            changed = []
        # Incremental closeout: the first turn by which a question's accumulated
        # real facts satisfy ALL its criteria is when it goes green — so greens
        # land naturally through the call instead of all at the end.
        for q in call.questions:
            if q.id in answered_at or not q.facts:
                continue
            if (await closeout(llm, q, q.facts)).answered:
                answered_at[q.id] = round(turn["end"], 2)
        history.append((round(turn["end"], 2), json.loads(json.dumps(call.snapshot()))))
        greens = "".join("✓" if q.id in answered_at else "·" for q in call.questions)
        print(f"  turn {i:>2} @{turn['start']:6.1f}s  changed: {','.join(changed) or '-':<10} green:[{greens}]")

    # Rebuild coverage packets from the per-turn snapshots, upgrading a question to
    # answered from answered_at onward (monotonic, no regression). Each snapshot
    # already carries the facts accumulated up to that turn.
    coverage_packets: list[dict] = [{"at": 0.0, "type": "coverage_update", "data": call_initial_snapshot(args.questions)}]
    for t, snap in history:
        for card in snap["questions"]:
            ae = answered_at.get(card["id"])
            if ae is not None and t >= ae:
                card["state"] = ANSWERED
                card["followup"] = None
        snap["counts"] = _tally(snap["questions"])
        coverage_packets.append({"at": t, "type": "coverage_update", "data": snap})

    packets = sorted(transcript_packets + coverage_packets, key=lambda p: (p["at"], 0 if p["type"] == "transcript" else 1))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(AUDIO_SRC, OUT_DIR / "call.mp3")
    timeline = {
        "audio": "/demo/realcall/call.mp3",
        "company": call.company,
        "ticker": call.ticker,
        "source": "Apple Q2 FY26 earnings call (real audio) — pretend expert/diligence call",
        "packets": packets,
    }
    (OUT_DIR / "timeline.json").write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    print(f"\nfinal coverage: {_tally(history[-1][1]['questions']) if history else {}} (pre-closeout)")
    print(f"answered after closeout: {sorted(answered_at)}")
    print(f"wrote {len(packets)} packets + call.mp3 to {OUT_DIR}")


def _tally(cards: list[dict]) -> dict[str, int]:
    out = {"unanswered": 0, "partial": 0, "answered": 0}
    for c in cards:
        out[c["state"]] = out.get(c["state"], 0) + 1
    return out


def call_initial_snapshot(questions_path: str) -> dict:
    """A fresh all-unanswered snapshot for the t=0 packet."""
    return CallState.from_file(questions_path).snapshot()


if __name__ == "__main__":
    asyncio.run(main())
