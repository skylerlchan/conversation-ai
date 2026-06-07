"""Run a live diligence call from an audio file and drive the analyst console.

The "video in the background" demo: point this at the real earnings-call audio
(e.g. the downloaded CAVA Q1 2026 call), and it streams the audio through the
SAME backend the live agent uses — LiveKit Inference STT (deepgram/nova-3) for
real-time transcription, then the coverage engine (engine.grade_turn) to score
each chunk against the analyst's pre-loaded questions and ground it against the
fund's model. After every graded chunk it POSTs the full coverage snapshot to
the frontend's /api/live endpoint; the /live console polls and renders it.

This is the reliable, zero-setup demo transport. The production path is the same
engine inside agent.py, publishing LiveKit data packets. Same brains, two pipes.

Usage (from agent-py/):

    uv run python demo/run_live_call.py \\
        --audio demo/audio/cava_earnings_q1_2026.wav \\
        --questions demo/cava_questions_agent.json \\
        --endpoint http://localhost:3001/api/live \\
        --start-min 1 --max-min 12

Requires LIVEKIT_* in agent-py/.env.local (Inference STT/LLM are billed via LiveKit).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import urllib.request
import wave
from pathlib import Path

from dotenv import load_dotenv

SRC = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC))
load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

from livekit import rtc  # noqa: E402
from livekit.agents import inference  # noqa: E402
from livekit.agents.stt import SpeechEventType  # noqa: E402
from livekit.agents.utils import http_context  # noqa: E402

from coverage import CallState, apply_verdict  # noqa: E402
from engine import grade_turn  # noqa: E402


def assumptions_of(call: CallState) -> list[dict]:
    """The fund's model — the variant view the copilot grounds against."""
    out = []
    for q in call.questions:
        exp = q.expected or {}
        out.append(
            {
                "id": q.id,
                "pillar": q.pillar,
                "note": exp.get("note_models", ""),
                "our_view": exp.get("our_view", ""),
            }
        )
    return out


def grounding_of(call: CallState) -> str:
    lines = []
    for q in call.questions:
        exp = q.expected or {}
        if exp.get("note_models"):
            lines.append(f"{q.id} ({q.question[:60]}): our model = {exp['note_models']}")
    return "Our model (the note) assumes:\n" + "\n".join(lines)


def post(endpoint: str, payload: dict) -> None:
    try:
        data = json.dumps(payload, default=str).encode("utf-8")
        req = urllib.request.Request(
            endpoint, data=data, headers={"Content-Type": "application/json"}, method="POST"
        )
        urllib.request.urlopen(req, timeout=5).read()
    except Exception as e:  # noqa: BLE001
        print(f"  (post failed: {e})", flush=True)


def snapshot(call: CallState, transcript: list[str], speaking: str) -> dict:
    snap = call.snapshot()
    snap["assumptions"] = assumptions_of(call)
    snap["transcript"] = transcript[-8:]
    snap["now_speaking"] = speaking
    return snap


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--questions", default=str(Path(__file__).parent / "cava_questions_agent.json"))
    ap.add_argument("--endpoint", default="http://localhost:3001/api/live")
    ap.add_argument("--speed", type=float, default=1.0, help="playback speed (1.0 = real time)")
    ap.add_argument("--chunk-chars", type=int, default=220, help="grade a turn after ~this much text")
    ap.add_argument("--start-min", type=float, default=0.0)
    ap.add_argument("--max-min", type=float, default=0.0, help="stop after N minutes (0 = full)")
    args = ap.parse_args()

    call = CallState.from_file(Path(args.questions))
    grounding = grounding_of(call)
    transcript: list[str] = []
    print(f"loaded {len(call.questions)} questions for {call.company} ({call.ticker})", flush=True)
    post(args.endpoint, snapshot(call, transcript, ""))  # initial: questions + assumptions

    wf = wave.open(args.audio, "rb")
    sr, ch = wf.getframerate(), wf.getnchannels()
    if args.start_min:
        wf.setpos(int(args.start_min * 60 * sr))
    max_frames = int(args.max_min * 60 * sr) if args.max_min else None

    async with http_context.open():
        stt = inference.STT(model="deepgram/nova-3", language="en")
        vllm = inference.LLM(model="openai/gpt-5.2-chat-latest")
        stream = stt.stream()
        buf: list[str] = []

        async def grade(text: str) -> None:
            verdict = await grade_turn(vllm, call, text, grounding=grounding)
            changed = apply_verdict(call, verdict)
            for u in verdict.updates:
                tag = " +followup" if u.followup else ""
                tag += " ⚠CONTRADICTION" if u.contradiction else ""
                print(f"   → {u.question_id} = {u.coverage}{tag}", flush=True)
            if changed:
                print(f"   counts: {call.counts()}", flush=True)
            post(args.endpoint, snapshot(call, transcript, text))

        async def reader() -> None:
            async for ev in stream:
                if not ev.alternatives:
                    continue
                txt = ev.alternatives[0].text.strip()
                if ev.type == SpeechEventType.INTERIM_TRANSCRIPT and txt:
                    post(args.endpoint, snapshot(call, transcript, txt))
                elif ev.type == SpeechEventType.FINAL_TRANSCRIPT and txt:
                    transcript.append(txt)
                    buf.append(txt)
                    if len(" ".join(buf)) >= args.chunk_chars:
                        chunk = " ".join(buf)
                        buf.clear()
                        print(f"\n[turn] {chunk[:110]}…", flush=True)
                        await grade(chunk)

        r = asyncio.create_task(reader())
        step = (sr // 10) * ch * 2  # 100ms of 16-bit
        pushed = 0
        while True:
            raw = wf.readframes(sr // 10)
            if not raw:
                break
            ns = len(raw) // (ch * 2)
            stream.push_frame(
                rtc.AudioFrame(data=raw, sample_rate=sr, num_channels=ch, samples_per_channel=ns)
            )
            pushed += ns
            if max_frames and pushed >= max_frames:
                break
            await asyncio.sleep(0.1 / max(args.speed, 0.01))

        if buf:
            await grade(" ".join(buf))
        stream.end_input()
        try:
            await asyncio.wait_for(r, timeout=10)
        except asyncio.TimeoutError:
            r.cancel()
        print(f"\nDone. Final coverage: {call.counts()}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
