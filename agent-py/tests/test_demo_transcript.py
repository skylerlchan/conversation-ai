"""Golden-fixture tests for the CAVA diligence-call demo.

These are deterministic, dependency-free tests over the demo fixtures in
`agent-py/demo/`. They run today (no Moss, no LiveKit, no network) and serve two
purposes:

1. **Guard the demo.** The scripted call is the spine of the live demo. If
   someone edits the transcript and accidentally breaks the hero arc — the
   partial->answered follow-up, the single inconsistency flag, the all-green
   close — these tests fail loudly before stage.
2. **Golden file for the coverage engine.** Each researcher turn in
   `cava_call.json` carries an `expected` coverage verdict. When the coverage
   engine (the one genuinely new piece, per the plan) is built, it can be graded
   turn-by-turn against this same fixture.

The product rules being enforced come straight from the plan's coverage state
machine: every question is driven to `answered`; states only move forward
(unanswered -> partial -> answered); a `partial` must always fire a good,
specific follow-up; coverage gaps must be caught while the researcher is still
on the line.
"""

import json
from pathlib import Path

import pytest

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"

STATE_ORDER = {"unanswered": 0, "partial": 1, "answered": 2}

# Generic follow-ups are the failure mode the plan calls out by name: "If it
# says 'can you elaborate,' the wow dies." A partial must produce a sharp,
# grounded question, not these.
GENERIC_FOLLOWUP_PHRASES = (
    "can you elaborate",
    "can you expand",
    "say more",
    "tell me more",
    "more detail",
    "more color",
)


def _load(name: str) -> dict:
    return json.loads((DEMO_DIR / name).read_text())


@pytest.fixture(scope="module")
def questions() -> dict:
    return _load("cava_questions.json")


@pytest.fixture(scope="module")
def corpus() -> dict:
    return _load("cava_corpus.json")


@pytest.fixture(scope="module")
def call() -> dict:
    return _load("cava_call.json")


@pytest.fixture(scope="module")
def question_ids(questions) -> set[str]:
    return {q["id"] for q in questions["questions"]}


def _researcher_turns(call) -> list[dict]:
    return [t for t in call["turns"] if t["speaker"] == "researcher"]


def _analyst_turns(call) -> list[dict]:
    return [t for t in call["turns"] if t["speaker"] == "analyst"]


# --------------------------------------------------------------------------- #
# Fixtures are well-formed
# --------------------------------------------------------------------------- #


def test_question_list_has_eight_unique_questions(questions, question_ids):
    qs = questions["questions"]
    assert len(qs) == 8, "demo is designed around 8 pre-call questions"
    assert len(question_ids) == 8, "question ids must be unique"
    assert question_ids == {f"Q{i}" for i in range(1, 9)}


def test_every_corpus_chunk_grounds_a_real_question(corpus, question_ids):
    for chunk in corpus["chunks"]:
        gq = chunk.get("grounds_question")
        assert gq in question_ids, f"corpus chunk {chunk['id']} grounds unknown {gq}"


def test_turns_are_sequentially_numbered(call):
    ts = [t["t"] for t in call["turns"]]
    assert ts == list(range(1, len(ts) + 1)), "turn `t` must be 1..N in order"


def test_every_turn_is_analyst_or_researcher(call):
    for t in call["turns"]:
        assert t["speaker"] in {"analyst", "researcher"}
        assert t.get("text"), f"turn {t['t']} has no text"


def test_researcher_turns_carry_expected_block(call):
    for t in _researcher_turns(call):
        exp = t.get("expected")
        assert exp is not None, f"researcher turn {t['t']} missing `expected`"
        assert exp["addresses"], f"turn {t['t']} addresses no question"
        for qid, state in exp["coverage"].items():
            assert state in STATE_ORDER, f"turn {t['t']}: bad state {state!r}"


# --------------------------------------------------------------------------- #
# Every referenced question id is real
# --------------------------------------------------------------------------- #


def test_all_referenced_ids_are_known_questions(call, question_ids):
    for t in call["turns"]:
        for qid in t.get("asks", []) or []:
            assert qid in question_ids, f"turn {t['t']} asks unknown {qid}"
        if t.get("is_followup_for"):
            assert t["is_followup_for"] in question_ids
        exp = t.get("expected")
        if exp:
            for qid in exp["addresses"]:
                assert qid in question_ids, f"turn {t['t']} addresses unknown {qid}"
            for qid in exp["coverage"]:
                assert qid in question_ids
            contra = exp.get("contradiction")
            if contra:
                assert contra["vs"] in {"note", "earlier_turn"}


# --------------------------------------------------------------------------- #
# Coverage state machine: forward-only, everything ends green
# --------------------------------------------------------------------------- #


def _replay(call, question_ids) -> dict[str, str]:
    """Walk researcher turns in order; return final state per question.

    Asserts coverage never moves backward (the state machine is a one-way
    ratchet: unanswered -> partial -> answered).
    """
    state = {qid: "unanswered" for qid in question_ids}
    for t in _researcher_turns(call):
        for qid, new_state in t["expected"]["coverage"].items():
            assert STATE_ORDER[new_state] >= STATE_ORDER[state[qid]], (
                f"turn {t['t']}: {qid} moved backward "
                f"{state[qid]} -> {new_state}"
            )
            state[qid] = new_state
    return state


def test_coverage_only_moves_forward_and_ends_all_green(call, question_ids):
    final = _replay(call, question_ids)
    assert all(s == "answered" for s in final.values()), (
        f"every question must hang up green; got {final}"
    )


def test_final_coverage_matches_replay(call, question_ids):
    final = _replay(call, question_ids)
    assert final == call["final_coverage"]
    assert set(call["final_coverage"]) == question_ids


# --------------------------------------------------------------------------- #
# The hero arc: exactly one partial, closed by a grounded follow-up
# --------------------------------------------------------------------------- #


def test_exactly_one_question_passes_through_partial(call, question_ids):
    went_partial = set()
    for t in _researcher_turns(call):
        for qid, state in t["expected"]["coverage"].items():
            if state == "partial":
                went_partial.add(qid)
    assert went_partial == {"Q2"}, (
        "the demo's single hero amber should be Q2 (new-unit economics); "
        f"got {went_partial}"
    )


def test_partial_always_fires_a_specific_followup(call):
    for t in _researcher_turns(call):
        exp = t["expected"]
        is_partial = any(s == "partial" for s in exp["coverage"].values())
        if is_partial:
            fu = exp.get("followup")
            assert fu, f"turn {t['t']} is partial but fires no follow-up"
            lowered = fu.lower()
            assert not any(p in lowered for p in GENERIC_FOLLOWUP_PHRASES), (
                f"turn {t['t']} follow-up is generic: {fu!r}"
            )
            assert len(fu) > 40, "a real follow-up is specific, not a one-liner"


def test_non_partial_turns_do_not_fire_followups(call):
    """Follow-ups are the partial-state lever; answered turns shouldn't nag."""
    for t in _researcher_turns(call):
        exp = t["expected"]
        if not any(s == "partial" for s in exp["coverage"].values()):
            assert exp.get("followup") is None, (
                f"turn {t['t']} is not partial but emits a follow-up"
            )


def test_hero_followup_turn_closes_q2_after_it_goes_partial(call):
    partial_t = next(
        t["t"]
        for t in _researcher_turns(call)
        if t["expected"]["coverage"].get("Q2") == "partial"
    )
    answered_t = next(
        t["t"]
        for t in _researcher_turns(call)
        if t["expected"]["coverage"].get("Q2") == "answered"
    )
    followup_t = next(
        t["t"] for t in _analyst_turns(call) if t.get("is_followup_for") == "Q2"
    )
    # partial -> analyst follow-up -> answered, in that order.
    assert partial_t < followup_t <= answered_t
    # And the analyst was prompted by the copilot to ask it.
    fu_turn = next(t for t in call["turns"] if t["t"] == followup_t)
    assert fu_turn.get("prompted_by_copilot")


# --------------------------------------------------------------------------- #
# The inconsistency: exactly one, on the planted question, vs the note
# --------------------------------------------------------------------------- #


def test_exactly_one_contradiction_on_q4_vs_note(call):
    contradictions = [
        (t["t"], qid, t["expected"]["contradiction"])
        for t in _researcher_turns(call)
        for qid in t["expected"]["addresses"]
        if t["expected"].get("contradiction")
    ]
    assert len(contradictions) == 1, (
        f"demo plants exactly one inconsistency; got {len(contradictions)}"
    )
    _t, qid, contra = contradictions[0]
    assert qid == "Q4", "the planted inconsistency is on Q4 (traffic vs price)"
    assert contra["vs"] == "note"
    assert contra["detail"], "a contradiction must cite what it contradicts"


# --------------------------------------------------------------------------- #
# The end-of-call nudge: Q7 is the last to go green, and only after a nudge
# --------------------------------------------------------------------------- #


def test_q7_is_nudged_and_is_the_last_to_close(call, question_ids):
    # The turn that answers Q7.
    q7_turn = next(
        t for t in _researcher_turns(call)
        if t["expected"]["coverage"].get("Q7") == "answered"
    )
    # Replay everything strictly before that turn: all OTHER questions are
    # already green, and Q7 is still grey — i.e. Q7 is the last hole.
    state = {qid: "unanswered" for qid in question_ids}
    for t in _researcher_turns(call):
        if t["t"] >= q7_turn["t"]:
            break
        for qid, s in t["expected"]["coverage"].items():
            state[qid] = s
    assert state["Q7"] == "unanswered", "Q7 should sit grey until the nudge"
    assert all(
        s == "answered" for q, s in state.items() if q != "Q7"
    ), "Q7 must be the final question still open before its close"

    # The analyst turn that raises Q7 was prompted by the copilot nudge.
    q7_ask = next(
        t for t in _analyst_turns(call)
        if "Q7" in (t.get("asks") or []) and t["t"] < q7_turn["t"]
    )
    assert q7_ask.get("prompted_by_copilot"), "Q7 should be raised via copilot nudge"


# --------------------------------------------------------------------------- #
# Close-the-loop: the thesis delta is grounded in real turns
# --------------------------------------------------------------------------- #


def test_thesis_delta_changes_point_to_real_researcher_turns(call):
    researcher_t = {t["t"] for t in _researcher_turns(call)}
    changes = call["thesis_delta"]["changes"]
    assert changes, "the call should produce at least one thesis change"
    for ch in changes:
        assert ch["source_turn"] in researcher_t, (
            f"thesis change {ch['field']} cites non-researcher turn "
            f"{ch['source_turn']}"
        )
        assert ch["from"] and ch["to"], "a thesis change needs from/to"
