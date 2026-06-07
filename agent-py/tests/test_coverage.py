"""Unit tests for the coverage state machine (src/coverage.py)."""

import json

import pytest

from coverage import (
    ANSWERED,
    PARTIAL,
    UNANSWERED,
    CallState,
    QuestionUpdate,
    TurnVerdict,
    apply_verdict,
)


def _data(n: int = 3) -> dict:
    return {
        "company": "Cirrus Logistics, Inc.",
        "ticker": "CRLG",
        "thesis": "Connect's contribution margin is underappreciated.",
        "questions": [
            {
                "id": f"q{i}",
                "pillar": f"pillar {i}",
                "question": f"Question {i}?",
                "complete_when": [f"criterion {i}a", f"criterion {i}b"],
                "expected": {"note_models": "12%", "our_view": "18-20%"},
                "state": "unanswered",
            }
            for i in range(1, n + 1)
        ],
    }


def test_loads_questions_all_unanswered() -> None:
    call = CallState.from_dict(_data(3))
    assert call.company == "Cirrus Logistics, Inc."
    assert call.ticker == "CRLG"
    assert [q.id for q in call.questions] == ["q1", "q2", "q3"]
    assert all(q.state == UNANSWERED for q in call.questions)


def test_carries_complete_when_and_expected() -> None:
    call = CallState.from_dict(_data(1))
    q = call.questions[0]
    # These two fields are what the coverage engine grades + grounds against.
    assert q.complete_when == ["criterion 1a", "criterion 1b"]
    assert q.expected == {"note_models": "12%", "our_view": "18-20%"}
    assert q.pillar == "pillar 1"


def test_counts_and_all_answered() -> None:
    call = CallState.from_dict(_data(3))
    assert call.counts() == {UNANSWERED: 3, PARTIAL: 0, ANSWERED: 0}
    assert not call.all_answered()

    call.questions[0].state = ANSWERED
    call.questions[1].state = PARTIAL
    assert call.counts() == {UNANSWERED: 1, PARTIAL: 1, ANSWERED: 1}

    for q in call.questions:
        q.state = ANSWERED
    assert call.all_answered()


def test_missing_id_defaulted_empty_skipped_bad_state_reset() -> None:
    call = CallState.from_dict(
        {
            "thesis": "",
            "questions": [
                {"question": "Has no id."},
                {"id": "keep", "question": "Has an id.", "state": "answered"},
                {"id": "blank", "question": "   "},
                {"id": "bad", "question": "Bad state.", "state": "nonsense"},
            ],
        }
    )
    # Blank-text dropped; missing id -> 1-based index; bad state -> unanswered;
    # a valid file state ("answered") is honored.
    assert [(q.id, q.state) for q in call.questions] == [
        ("q1", UNANSWERED),
        ("keep", ANSWERED),
        ("bad", UNANSWERED),
    ]


def test_requires_at_least_one_question() -> None:
    with pytest.raises(ValueError):
        CallState.from_dict({"thesis": "x", "questions": []})


def test_snapshot_shape_is_console_ready() -> None:
    call = CallState.from_dict(_data(2))
    snap = call.snapshot()
    assert set(snap) == {"company", "ticker", "thesis", "questions", "counts"}
    assert snap["counts"] == {UNANSWERED: 2, PARTIAL: 0, ANSWERED: 0}
    card = snap["questions"][0]
    assert set(card) == {
        "id",
        "question",
        "pillar",
        "state",
        "facts",
        "contradictions",
        "followup",
    }


def test_from_file_round_trip(tmp_path) -> None:
    path = tmp_path / "questions.json"
    path.write_text(json.dumps(_data(4)), encoding="utf-8")
    call = CallState.from_file(path)
    assert len(call.questions) == 4


def _verdict(**kw) -> TurnVerdict:
    """One-question verdict with sensible defaults for the unset fields."""
    kw.setdefault("extracted_facts", [])
    kw.setdefault("contradiction", "")
    kw.setdefault("followup", "")
    return TurnVerdict(updates=[QuestionUpdate(**kw)])


def test_apply_verdict_advances_state_and_attaches_followup() -> None:
    call = CallState.from_dict(_data(2))
    changed = apply_verdict(
        call,
        _verdict(
            question_id="q1",
            coverage="partial",
            extracted_facts=["Connect margin ~14% blended"],
            followup="Ask for the margin ex-capitalized-software.",
        ),
    )
    assert changed == ["q1"]
    q1 = call.by_id("q1")
    assert q1.state == PARTIAL
    assert q1.facts == ["Connect margin ~14% blended"]
    assert q1.followup == "Ask for the margin ex-capitalized-software."


def test_apply_verdict_is_monotonic_never_regresses() -> None:
    call = CallState.from_dict(_data(1))
    call.questions[0].state = ANSWERED
    apply_verdict(call, _verdict(question_id="q1", coverage="partial", followup="x"))
    # An answered question never drops back to partial.
    assert call.by_id("q1").state == ANSWERED


def test_apply_verdict_answered_clears_followup() -> None:
    call = CallState.from_dict(_data(1))
    apply_verdict(
        call, _verdict(question_id="q1", coverage="partial", followup="ask X")
    )
    assert call.by_id("q1").followup == "ask X"
    apply_verdict(
        call,
        _verdict(
            question_id="q1", coverage="answered", extracted_facts=["full answer"]
        ),
    )
    assert call.by_id("q1").state == ANSWERED
    assert call.by_id("q1").followup is None


def test_apply_verdict_records_contradiction_and_dedupes_facts() -> None:
    call = CallState.from_dict(_data(1))
    apply_verdict(
        call,
        _verdict(
            question_id="q1",
            coverage="partial",
            extracted_facts=["f1", "f1", " f1 "],
            contradiction="Contradicts the note's modeled 12%.",
        ),
    )
    q1 = call.by_id("q1")
    assert q1.facts == ["f1"]
    assert q1.contradictions == ["Contradicts the note's modeled 12%."]


def test_apply_verdict_ignores_unknown_question() -> None:
    call = CallState.from_dict(_data(1))
    changed = apply_verdict(call, _verdict(question_id="nope", coverage="answered"))
    assert changed == []
    assert call.by_id("q1").state == UNANSWERED


def test_apply_verdict_multiple_questions_in_one_turn() -> None:
    call = CallState.from_dict(_data(3))
    changed = apply_verdict(
        call,
        TurnVerdict(
            updates=[
                QuestionUpdate(
                    question_id="q1",
                    coverage="answered",
                    extracted_facts=["a"],
                    contradiction="",
                    followup="",
                ),
                QuestionUpdate(
                    question_id="q2",
                    coverage="partial",
                    extracted_facts=[],
                    contradiction="",
                    followup="ask more",
                ),
            ]
        ),
    )
    assert set(changed) == {"q1", "q2"}
    assert call.counts() == {UNANSWERED: 1, PARTIAL: 1, ANSWERED: 1}
