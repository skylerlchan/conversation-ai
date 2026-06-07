"""Live grading check: the real call answers drive the first 3 questions green.

This is the end-to-end guarantee behind the demo — when the analyst plays the
Apple Q2 FY26 question video (public/apple-earnings-questions.mp4) into the call,
the coverage engine must mark each question ``answered`` once management actually
answers it. This test replays the REAL management answers from that call
(demo/apple_call_answers.json) through the REAL coverage engine
(``engine.grade_turn`` on ``inference.LLM``) against the live question list
(questions.json), then asserts the first three diligence questions — q1 (iPhone
cycle), q2 (supply constraints), q3 (Mac breadth + geography) — all reach
``answered``.

It makes real model calls, so it is OPT-IN: it runs only when ``RUN_LIVE_GRADING``
is set AND LiveKit inference credentials are present. The default ``uv run pytest``
stays deterministic and free (the engine's parse path is covered by
test_engine.py with a stubbed LLM). Run it explicitly:

    RUN_LIVE_GRADING=1 uv run pytest tests/test_apple_call_grading.py -v -s
"""

import json
import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

from coverage import CallState, apply_verdict
from engine import grade_turn

ROOT = Path(__file__).resolve().parent.parent
DEMO_DIR = ROOT / "demo"

# Load LiveKit inference creds from .env.local the same way the agent does.
load_dotenv(ROOT / ".env.local")

# The working slice: the first pillar's three questions must go green from the
# real answers. (q4–q9 are graded in the same run if present, but only these are
# asserted — see the demo scope.)
TARGET = ("q1", "q2", "q3")

_HAVE_CREDS = all(
    os.getenv(k) for k in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET")
)

pytestmark = pytest.mark.skipif(
    not (os.getenv("RUN_LIVE_GRADING") and _HAVE_CREDS),
    reason="opt-in live grading test; set RUN_LIVE_GRADING=1 with LiveKit creds present",
)


async def test_real_answers_mark_first_three_answered() -> None:
    from livekit.agents import inference

    call = CallState.from_file(ROOT / "questions.json")
    fixture = json.loads((DEMO_DIR / "apple_call_answers.json").read_text())
    answers = fixture["answers"]

    # Only the questions actually on the board (so the fixture can carry answers
    # for q4–q9 too, but a 9- or 3-question list both replay cleanly).
    ids = {q.id for q in call.questions}
    turns = [a for a in answers if set(a.get("covers", [])) & ids]
    assert turns, "fixture has no answers for the loaded question list"

    llm = inference.LLM(model="openai/gpt-4.1-mini")
    for i, turn in enumerate(turns, start=1):
        verdict = await grade_turn(llm, call, turn["answer"])
        changed = apply_verdict(call, verdict)
        print(
            f"[{i}/{len(turns)}] {turn['analyst']}: "
            f"{[(u.question_id, u.coverage) for u in verdict.updates]} "
            f"-> changed {changed} -> {call.counts()}"
        )

    states = {q.id: q.state for q in call.questions}
    not_answered = [qid for qid in TARGET if states.get(qid) != "answered"]
    assert not not_answered, (
        f"these target questions never reached 'answered': {not_answered}. "
        f"Final states: { {qid: states.get(qid) for qid in TARGET} }"
    )
