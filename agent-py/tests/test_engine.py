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
from engine import grade_turn


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

    await listener._score_turn("It's mid-teens, blended.")

    q1 = listener._call.by_id("q1")
    assert q1.state == "partial"
    assert q1.facts == ["blended mid-teens"]
    assert q1.followup == "Ask ex-capitalized-software margin specifically."
