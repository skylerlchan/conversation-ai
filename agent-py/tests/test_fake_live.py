"""Replay-driver tests for the fake-live driver.

build_packets() folds the scripted Apple call's `expected` verdicts through the
SAME coverage state machine (apply_verdict) the live agent uses, then emits the
packet stream the console consumes. These assert the demo arc emerges from the
machinery — not from hand-authored snapshots — which is the Phase 2.1 check from
the build plan.
"""

import json
from pathlib import Path

from fake_live import build_packets

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = json.loads((ROOT / "questions.json").read_text(encoding="utf-8"))
CALL = json.loads((ROOT / "demo" / "apple_call.json").read_text(encoding="utf-8"))

N_QUESTIONS = len(QUESTIONS["questions"])


def _coverage_packets(packets):
    return [p["data"] for p in packets if p["type"] == "coverage_update"]


def _cards(snapshot):
    return {c["id"]: c for c in snapshot["questions"]}


def test_opens_all_unanswered():
    packets = build_packets(QUESTIONS, CALL)
    assert packets[0]["type"] == "coverage_update"
    assert packets[0]["data"]["counts"] == {
        "unanswered": N_QUESTIONS,
        "partial": 0,
        "answered": 0,
    }


def test_transcript_packet_per_turn():
    packets = build_packets(QUESTIONS, CALL)
    transcripts = [p for p in packets if p["type"] == "transcript"]
    assert len(transcripts) == len(CALL["turns"])
    # Turn indices are preserved and ordered.
    assert [p["data"]["t"] for p in transcripts] == [t["t"] for t in CALL["turns"]]


def test_q2_arc_partial_then_answered_with_contradiction():
    """The hero: q2 goes amber with a contradiction, then closes green on follow-up."""
    snapshots = _coverage_packets(build_packets(QUESTIONS, CALL))
    q2_states = [_cards(s)["q2"]["state"] for s in snapshots]

    # Monotonic arc: unanswered -> partial -> answered, partial before answered.
    assert "partial" in q2_states
    assert "answered" in q2_states
    assert q2_states.index("partial") < q2_states.index("answered")

    # The contradiction was recorded while q2 was thin.
    partial_snap = next(s for s in snapshots if _cards(s)["q2"]["state"] == "partial")
    assert _cards(partial_snap)["q2"]["contradictions"], "expected a contradiction on the thin q2 answer"

    # A grounded follow-up was attached while thin, then cleared once answered.
    assert _cards(partial_snap)["q2"]["followup"]
    final = _cards(snapshots[-1])["q2"]
    assert final["state"] == "answered"
    assert final["followup"] is None


def test_hangs_up_all_green():
    snapshots = _coverage_packets(build_packets(QUESTIONS, CALL))
    final = snapshots[-1]
    assert final["counts"] == {
        "unanswered": 0,
        "partial": 0,
        "answered": N_QUESTIONS,
    }
    assert CALL["final_coverage"] == {
        f"q{i}": "answered" for i in range(1, N_QUESTIONS + 1)
    }
