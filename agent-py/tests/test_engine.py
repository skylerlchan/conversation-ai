"""Tests for the coverage engine (src/engine.py) with a stubbed LLM.

The engine's only LLM dependency is ``inference.LLM.chat(...).collect().text``
returning a JSON string. A fake LLM that returns canned JSON lets us test the
prompt assembly and the parse → verdict path deterministically, with no network
or credentials. The live model call is smoke-tested separately.
"""

import json

import pytest

import agent as agent_module
from agent import DiligenceListener
from coverage import CallState, TurnVerdict
from engine import grade_turn, summarize_grounding, summarize_question_notes


class _FakeStream:
    def __init__(self, text: str) -> None:
        self._text = text

    async def collect(self):
        return type("CollectedResponse", (), {"text": self._text})()


class _FakeLLM:
    """Stands in for inference.LLM — returns canned JSON from chat().collect()."""

    def __init__(self, payload: dict) -> None:
        self._text = json.dumps(payload)
        self.calls: list[dict] = []

    def chat(self, *, chat_ctx, response_format=None, **kwargs):
        self.calls.append({"chat_ctx": chat_ctx, "response_format": response_format})
        return _FakeStream(self._text)


def _call() -> CallState:
    return CallState.from_dict(
        {
            "company": "Cirrus Logistics, Inc.",
            "ticker": "CRLG",
            "thesis": "Connect contribution margin is underappreciated.",
            "questions": [
                {
                    "id": "q1",
                    "question": "What is Connect's contribution margin at scale?",
                    "complete_when": [
                        "a contribution-margin figure",
                        "ex-capitalized software",
                    ],
                    "expected": {"note_models": "12%", "our_view": "18-20%"},
                }
            ],
        }
    )


async def test_grade_turn_parses_verdict() -> None:
    fake = _FakeLLM(
        {
            "updates": [
                {
                    "question_id": "q1",
                    "coverage": "partial",
                    "extracted_facts": ["~14% blended"],
                    "contradiction": "",
                    "followup": "Ask for the margin ex-capitalized-software.",
                }
            ]
        }
    )
    verdict = await grade_turn(fake, _call(), "It's mid-teens, blended.")

    assert isinstance(verdict, TurnVerdict)
    assert verdict.updates[0].question_id == "q1"
    assert verdict.updates[0].coverage == "partial"
    # The engine requested our strict schema via response_format.
    assert fake.calls[0]["response_format"] is TurnVerdict


async def test_grade_turn_prompt_carries_questions_and_turn() -> None:
    fake = _FakeLLM({"updates": []})
    await grade_turn(fake, _call(), "Margins are fine, trust me.")

    chat_ctx = fake.calls[0]["chat_ctx"]
    rendered = " ".join(
        (getattr(item, "text_content", "") or "") for item in chat_ctx.items
    )
    # Both the question (with its grading criteria) and the live turn reached the model.
    assert "What is Connect's contribution margin at scale?" in rendered
    assert "ex-capitalized software" in rendered
    assert "Margins are fine, trust me." in rendered


async def test_grade_turn_includes_grounding_when_provided() -> None:
    fake = _FakeLLM({"updates": []})
    await grade_turn(
        fake,
        _call(),
        "It's around 12%.",
        grounding="From the memo: the note models 12% contribution margin for Connect.",
    )
    chat_ctx = fake.calls[0]["chat_ctx"]
    rendered = " ".join(
        (getattr(item, "text_content", "") or "") for item in chat_ctx.items
    )
    # The retrieved research context reached the model so it can cite real figures.
    assert "note models 12% contribution margin" in rendered


async def test_grade_turn_isolates_cacheable_prefix() -> None:
    """Cache-friendliness: the static prefix (rules + question definitions) is the
    system message, and per-turn volatile content (coverage state + the live turn)
    is the user message. This split is what lets the gateway prefix-cache the
    system message across turns — re-mixing them would silently break the cache.
    """
    fake = _FakeLLM({"updates": []})
    await grade_turn(fake, _call(), "Margins are fine, trust me.")

    items = fake.calls[0]["chat_ctx"].items
    system = next(i for i in items if getattr(i, "role", None) == "system")
    user = next(i for i in items if getattr(i, "role", None) == "user")
    sys_text = system.text_content or ""
    user_text = user.text_content or ""

    # Static definitions live in the cacheable system prefix...
    assert "What is Connect's contribution margin at scale?" in sys_text
    assert "ex-capitalized software" in sys_text
    # ...and the volatile turn does NOT (it would change the prefix every turn).
    assert "Margins are fine, trust me." not in sys_text
    # The volatile tail carries the live turn and the current coverage state.
    assert "Margins are fine, trust me." in user_text
    assert "q1: unanswered" in user_text


async def test_grade_turn_rules_err_toward_answered() -> None:
    """The grader's tie-break leans to 'answered' — a fair answer gets the benefit
    of the doubt rather than being held open. This coverage bias is a product
    decision the whole demo rides on, so pin it (the stubbed LLM can't judge, but
    the rendered rules can be asserted)."""
    fake = _FakeLLM({"updates": []})
    await grade_turn(fake, _call(), "Margins are fine, trust me.")

    items = fake.calls[0]["chat_ctx"].items
    system = next(i for i in items if getattr(i, "role", None) == "system")
    sys_text = (system.text_content or "").lower()
    # On the partial/answered boundary, default to answered...
    assert 'choose "answered"' in sys_text
    # ...and the old err-toward-partial instruction is gone.
    assert 'choose "partial"' not in sys_text


async def test_grade_turn_rules_question_is_not_an_answer() -> None:
    """Coverage must advance on the ANSWER, not when a question is merely asked.

    The grader scores every turn (analyst questions included), so the rules have to
    tell it that posing/repeating a question does not address it — otherwise a
    question flips green the moment it's raised, before anyone answers. Pinned at
    the prompt level (the stubbed LLM can't judge); the live behavior is guarded by
    test_apple_call_grading.test_posing_a_question_does_not_cover_it."""
    fake = _FakeLLM({"updates": []})
    await grade_turn(fake, _call(), "What is Connect's contribution margin at scale?")

    items = fake.calls[0]["chat_ctx"].items
    system = next(i for i in items if getattr(i, "role", None) == "system")
    # Normalize whitespace so line-wrapping in the rule string can't break the match.
    sys_text = " ".join((system.text_content or "").lower().split())
    assert "merely asking" in sys_text
    assert "never on the question being raised" in sys_text


async def test_summarize_grounding_briefs_the_analyst() -> None:
    """The digest LLM is fed the snippets and returns plain-text prose (no schema)."""

    class _SummaryLLM:
        def __init__(self, text: str) -> None:
            self._text = text
            self.calls: list[dict] = []

        def chat(self, *, chat_ctx, response_format=None, **kwargs):
            self.calls.append(
                {"chat_ctx": chat_ctx, "response_format": response_format}
            )
            return _FakeStream(self._text)

    fake = _SummaryLLM("Your note models GM ~44%; hold them to the memory-cost number.")
    out = await summarize_grounding(fake, ["note: GM ~44%", "filing: DRAM costs up"])

    assert "44%" in out
    # A summary is free prose — no structured schema is requested.
    assert fake.calls[0]["response_format"] is None
    rendered = " ".join(
        (getattr(i, "text_content", "") or "") for i in fake.calls[0]["chat_ctx"].items
    )
    assert "GM ~44%" in rendered and "DRAM costs up" in rendered


async def test_summarize_grounding_skips_the_llm_when_empty() -> None:
    """No snippets -> no LLM call, returns ''."""

    class _Boom:
        def chat(self, **kwargs):
            raise AssertionError("must not call the LLM with nothing to summarize")

    assert await summarize_grounding(_Boom(), []) == ""
    assert await summarize_grounding(_Boom(), ["   ", ""]) == ""


async def test_summarize_question_notes_parses_bullets() -> None:
    """The notes LLM is fed the question + snippets and returns a clean bullet list."""

    class _NotesLLM:
        def __init__(self, text: str) -> None:
            self._text = text
            self.calls: list[dict] = []

        def chat(self, *, chat_ctx, response_format=None, **kwargs):
            self.calls.append(
                {"chat_ctx": chat_ctx, "response_format": response_format}
            )
            return _FakeStream(self._text)

    fake = _NotesLLM(
        "- iPhone +22% YoY — Q2 FY26 call\n- Company GM 49.3% — AAPL 10-Q\n"
    )
    out = await summarize_question_notes(
        fake,
        "How strong is the iPhone cycle?",
        ["[Q2 FY26 call] iPhone grew 22%", "[AAPL 10-Q p.5] gross margin was 49.3%"],
    )
    # Leading bullet markers stripped; one note per line; free prose (no schema).
    assert out == ["iPhone +22% YoY — Q2 FY26 call", "Company GM 49.3% — AAPL 10-Q"]
    assert fake.calls[0]["response_format"] is None
    rendered = " ".join(
        (getattr(i, "text_content", "") or "") for i in fake.calls[0]["chat_ctx"].items
    )
    assert (
        "How strong is the iPhone cycle?" in rendered and "iPhone grew 22%" in rendered
    )


async def test_summarize_question_notes_skips_when_empty() -> None:
    """No question or no snippets -> no LLM call, returns []."""

    class _Boom:
        def chat(self, **kwargs):
            raise AssertionError("must not call the LLM with nothing to summarize")

    assert await summarize_question_notes(_Boom(), "Q?", []) == []
    assert await summarize_question_notes(_Boom(), "", ["[src] fact"]) == []


@pytest.fixture
def stub_moss(monkeypatch):
    class _FakeMoss:
        def __init__(self, *a, **k):
            pass

        async def load_index(self, *a, **k):
            return None

        async def query(self, *a, **k):
            return type("R", (), {"docs": []})()

    monkeypatch.setattr(agent_module, "MossClient", _FakeMoss)


async def test_listener_score_turn_updates_state(stub_moss) -> None:
    """End to end through the listener: a scored turn moves the question to partial."""
    fake = _FakeLLM(
        {
            "updates": [
                {
                    "question_id": "q1",
                    "coverage": "partial",
                    "extracted_facts": ["blended mid-teens"],
                    "contradiction": "",
                    "followup": "Ask ex-capitalized-software margin specifically.",
                }
            ]
        }
    )
    listener = DiligenceListener(user_id="fund_1", call_state=_call(), verdict_llm=fake)

    await listener._score_turn(1, "It's mid-teens, blended.")

    q1 = listener._call.by_id("q1")
    assert q1.state == "partial"
    assert q1.facts == ["blended mid-teens"]
    assert q1.followup == "Ask ex-capitalized-software margin specifically."


async def test_listener_skips_grading_analyst_turns(stub_moss) -> None:
    """Coverage advances on the researcher's ANSWER, never when the analyst asks.

    The grader over-credits a posed question (verified live in
    test_apple_call_grading), so the fix gates on the diarized speaker, not the
    model: an analyst turn is never scored — the LLM isn't even consulted — while
    the researcher answering the same question does advance it.
    """
    fake = _FakeLLM(
        {
            "updates": [
                {
                    "question_id": "q1",
                    "coverage": "answered",
                    "extracted_facts": ["~14% blended"],
                    "contradiction": "",
                    "followup": "",
                }
            ]
        }
    )
    listener = DiligenceListener(user_id="fund_1", call_state=_call(), verdict_llm=fake)

    # The analyst raising the question (its own text) must not touch coverage,
    # and must short-circuit before any LLM call.
    await listener._score_turn(
        1, "What is Connect's contribution margin at scale?", speaker="analyst"
    )
    assert listener._call.by_id("q1").state == "unanswered"
    assert fake.calls == []

    # The researcher answering the same question DOES advance it.
    await listener._score_turn(2, "It's about 14% blended.", speaker="researcher")
    assert listener._call.by_id("q1").state == "answered"
    assert fake.calls  # the grader ran this time
