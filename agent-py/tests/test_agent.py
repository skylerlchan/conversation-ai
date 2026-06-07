"""Silent-listener contract tests for the diligence copilot.

The agent must (1) consume each finalized researcher turn via
`on_user_turn_completed`, and (2) never produce a spoken reply. We exercise the
turn hook directly: the LiveKit test harness's `session.run()` assumes the agent
replies (it forces `_generate_reply`), which a silent listener never does, so the
hook contract is the right unit to pin. End-to-end silence is smoke-tested live.

These run with a stubbed `MossClient`, so no Moss credentials or network needed.
"""

import json

import pytest
from livekit.agents import StopResponse, llm

import agent as agent_module
from agent import DiligenceListener, SpeakerRoles
from coverage import CallState


def _sample_call() -> CallState:
    """A small in-memory question list so hook tests don't touch questions.json."""
    return CallState.from_dict(
        {
            "company": "Cirrus Logistics, Inc.",
            "ticker": "CRLG",
            "thesis": "Test thesis.",
            "questions": [{"id": "q1", "question": "What about margins?"}],
        }
    )


class _FakeMossClient:
    """Records calls instead of contacting Moss. Substituted for `MossClient`."""

    def __init__(self, *args, **kwargs) -> None:
        self.load_index_calls: list[str] = []

    async def load_index(self, name, *args, **kwargs):
        self.load_index_calls.append(name)

    async def query(self, *args, **kwargs):
        return type("R", (), {"docs": [], "time_taken_ms": 0.0})()

    async def add_docs(self, *args, **kwargs):
        return None


@pytest.fixture
def stub_moss(monkeypatch):
    """Replace the agent's `MossClient` with the recording fake."""
    monkeypatch.setattr(agent_module, "MossClient", _FakeMossClient)


def _user_turn(text: str):
    """Build a (turn_ctx, new_message) pair like the framework passes the hook."""
    ctx = llm.ChatContext.empty()
    message = ctx.add_message(role="user", content=text)
    return ctx, message


async def test_records_turn_and_stays_silent(stub_moss) -> None:
    """The hook captures the researcher turn and raises StopResponse (no reply)."""
    listener = DiligenceListener(user_id="fund_1", call_state=_sample_call())
    turn_ctx, message = _user_turn("Segment revenue grew low-teens last quarter.")

    # StopResponse is how the silent listener guarantees it never speaks.
    with pytest.raises(StopResponse):
        await listener.on_user_turn_completed(turn_ctx, message)

    assert listener._turns == ["Segment revenue grew low-teens last quarter."]


async def test_multiple_turns_accumulate_in_order(stub_moss) -> None:
    """Consecutive researcher turns accumulate in order, each staying silent."""
    listener = DiligenceListener(user_id="fund_1", call_state=_sample_call())

    for line in [
        "We expect margins to expand next year.",
        "Pricing held up despite the competition.",
    ]:
        turn_ctx, message = _user_turn(line)
        with pytest.raises(StopResponse):
            await listener.on_user_turn_completed(turn_ctx, message)

    assert listener._turns == [
        "We expect margins to expand next year.",
        "Pricing held up despite the competition.",
    ]


async def test_blank_turn_is_ignored(stub_moss) -> None:
    """A blank/whitespace turn records nothing but still stays silent."""
    listener = DiligenceListener(user_id="fund_1", call_state=_sample_call())
    turn_ctx, message = _user_turn("   ")

    with pytest.raises(StopResponse):
        await listener.on_user_turn_completed(turn_ctx, message)

    assert listener._turns == []


class _FakePublisher:
    def __init__(self) -> None:
        self.published: list[tuple] = []

    async def publish_data(self, payload, reliable=None):
        self.published.append((payload, reliable))


class _FakeRoom:
    def __init__(self) -> None:
        self.local_participant = _FakePublisher()


async def test_turn_publishes_transcript_packet(stub_moss) -> None:
    """A finalized turn is pushed to the console as a labeled transcript packet."""
    room = _FakeRoom()
    listener = DiligenceListener(room=room, user_id="fund_1", call_state=_sample_call())
    turn_ctx, message = _user_turn("Connect take-rate held at 18% this quarter.")

    with pytest.raises(StopResponse):
        await listener.on_user_turn_completed(turn_ctx, message)

    # Turn recorded, and exactly one transcript packet published (no verdict_llm,
    # so no coverage scoring fires).
    assert listener._turns == ["Connect take-rate held at 18% this quarter."]
    assert len(room.local_participant.published) == 1
    payload = json.loads(room.local_participant.published[0][0].decode("utf-8"))
    assert payload["type"] == "transcript"
    data = payload["data"]
    assert data["t"] == 1
    # The opening turn is the analyst ("you"), even with no diarization id.
    assert data["speaker"] == "analyst"
    assert data["text"] == "Connect take-rate held at 18% this quarter."
    assert isinstance(data["timestamp"], (int, float))


def test_speaker_roles_first_is_analyst_rest_researcher() -> None:
    """The first diarized speaker is the analyst; everyone after is a researcher."""
    roles = SpeakerRoles()
    assert roles.role_for("0") == "analyst"
    assert roles.role_for("1") == "researcher"
    assert roles.role_for("2") == "researcher"
    # Mapping is sticky: a speaker keeps its role for the rest of the call.
    assert roles.role_for("0") == "analyst"
    assert roles.role_for("1") == "researcher"


def test_speaker_roles_first_turn_is_analyst_without_diarization() -> None:
    """The opening turn is the analyst ("you") even with no diarization id, so the
    console always opens on a YOU turn. Every *later* turn falls back to researcher,
    the safe coverage default.
    """
    roles = SpeakerRoles()
    assert roles.role_for(None) == "analyst"
    assert roles.role_for(None) == "researcher"
    assert roles.role_for(None) == "researcher"
    # The opening turn consumes the analyst slot, so a real speaker after it is a
    # researcher.
    after_open = SpeakerRoles()
    assert after_open.role_for(None) == "analyst"
    assert after_open.role_for("7") == "researcher"


def _transcribed(speaker_id, is_final=True):
    """A minimal stand-in for UserInputTranscribedEvent (only fields we read)."""
    return type("Ev", (), {"speaker_id": speaker_id, "is_final": is_final})()


async def test_turns_labeled_by_diarized_speaker(stub_moss) -> None:
    """Diarization labels the transcript: first speaker analyst, next researcher."""
    room = _FakeRoom()
    listener = DiligenceListener(room=room, user_id="fund_1", call_state=_sample_call())

    # Analyst opens (speaker "0"), then the researcher answers (speaker "1").
    listener._on_user_input_transcribed(_transcribed("0"))
    with pytest.raises(StopResponse):
        await listener.on_user_turn_completed(*_user_turn("Let's start with margins."))

    listener._on_user_input_transcribed(_transcribed("1"))
    with pytest.raises(StopResponse):
        await listener.on_user_turn_completed(
            *_user_turn("Margins were up year on year.")
        )

    speakers = [
        json.loads(p[0].decode("utf-8"))["data"]["speaker"]
        for p in room.local_participant.published
    ]
    assert speakers == ["analyst", "researcher"]


async def test_interim_transcription_does_not_set_speaker(stub_moss) -> None:
    """Only finalized transcriptions set the turn speaker; interims are ignored."""
    listener = DiligenceListener(user_id="fund_1", call_state=_sample_call())
    listener._on_user_input_transcribed(_transcribed("0", is_final=False))
    assert listener._current_turn_speaker_id is None


async def test_publish_coverage_emits_snapshot_packet(stub_moss) -> None:
    """publish_coverage sends a reliable coverage_update packet with the snapshot."""
    room = _FakeRoom()
    listener = DiligenceListener(room=room, user_id="fund_1", call_state=_sample_call())

    await listener.publish_coverage()

    assert len(room.local_participant.published) == 1
    payload_bytes, reliable = room.local_participant.published[0]
    assert reliable is True

    payload = json.loads(payload_bytes.decode("utf-8"))
    assert payload["type"] == "coverage_update"
    data = payload["data"]
    # Snapshot fields + the contractual timestamp (epoch seconds).
    assert data["company"] == "Cirrus Logistics, Inc."
    assert data["counts"] == {"unanswered": 1, "partial": 0, "answered": 0}
    assert data["questions"][0]["id"] == "q1"
    assert isinstance(data["timestamp"], (int, float))


async def test_publish_is_noop_without_room(stub_moss) -> None:
    """With no room (unit context) publishing is a safe no-op, not an error."""
    listener = DiligenceListener(user_id="fund_1", call_state=_sample_call())
    await listener.publish_coverage()  # must not raise


async def test_score_turn_publishes_after_change(stub_moss) -> None:
    """A scored turn that changes coverage pushes a fresh coverage_update."""

    class _FakeStream:
        def __init__(self, text):
            self._text = text

        async def collect(self):
            return type("R", (), {"text": self._text})()

    class _FakeLLM:
        def chat(self, *, chat_ctx, response_format=None, **kwargs):
            return _FakeStream(
                json.dumps(
                    {
                        "updates": [
                            {
                                "question_id": "q1",
                                "coverage": "partial",
                                "extracted_facts": ["a fact"],
                                "contradiction": "",
                                "followup": "ask the specific number",
                            }
                        ]
                    }
                )
            )

    room = _FakeRoom()
    listener = DiligenceListener(
        room=room,
        user_id="fund_1",
        call_state=_sample_call(),
        verdict_llm=_FakeLLM(),
    )

    await listener._score_turn(1, "margins are fine")

    # State advanced...
    assert listener._call.by_id("q1").state == "partial"
    # ...and the change was published as a coverage_update.
    assert len(room.local_participant.published) == 1
    payload = json.loads(room.local_participant.published[0][0].decode("utf-8"))
    assert payload["type"] == "coverage_update"
    assert payload["data"]["counts"] == {"unanswered": 0, "partial": 1, "answered": 0}


async def test_ground_returns_and_buffers_snippets_without_publishing(
    stub_moss,
) -> None:
    """_ground returns this turn's snippets and buffers them for the periodic
    digest — but does NOT publish per turn (the analyst sees a summary instead)."""
    room = _FakeRoom()
    listener = DiligenceListener(room=room, user_id="fund_1", call_state=_sample_call())

    class _Doc:
        def __init__(self, text, score):
            self.text = text
            self.score = score

    class _MossWithDocs:
        async def query(self, *args, **kwargs):
            return type(
                "R",
                (),
                {
                    "docs": [
                        _Doc(
                            "The note models 12% contribution margin for Connect.", 0.94
                        ),
                        _Doc("Cirrus Connect is ~22% of revenue.", 0.81),
                    ]
                },
            )()

    listener._moss = _MossWithDocs()

    grounding = await listener._ground("Connect contribution margin?")

    # Returned to the grader this turn (so contradictions are caught live)...
    assert "note models 12%" in grounding
    assert "Cirrus Connect is ~22% of revenue." in grounding
    # ...and buffered for the periodic analyst digest...
    assert "The note models 12% contribution margin for Connect." in (
        listener._grounding_buffer
    )
    # ...but nothing is pushed to the console on this turn.
    assert room.local_participant.published == []


async def test_ground_buffers_snippets_with_source_labels(stub_moss) -> None:
    """When Moss docs carry metadata, buffered entries are tagged with a compact
    source cite so the periodic digest can attribute each fact to a source."""
    room = _FakeRoom()
    listener = DiligenceListener(room=room, user_id="fund_1", call_state=_sample_call())

    class _Doc:
        def __init__(self, text, metadata):
            self.text = text
            self.metadata = metadata

    class _MossWithDocs:
        async def query(self, *args, **kwargs):
            return type(
                "R",
                (),
                {
                    "docs": [
                        _Doc(
                            "iPhone revenue rose 22% year over year.",
                            {"ticker": "AAPL", "doc_type": "10-Q", "pages": "5"},
                        ),
                        _Doc(
                            "We model gross margin compressing on memory costs.",
                            {
                                "source": "Vantage Ridge AAPL pre-call thesis note",
                                "doc_type": "analyst-note",
                            },
                        ),
                    ]
                },
            )()

    listener._moss = _MossWithDocs()

    await listener._ground("iPhone revenue?")

    buf = listener._grounding_buffer
    # Filings collapse to a compact ticker/type/page cite...
    assert any(e.startswith("[AAPL 10-Q p.5] ") for e in buf)
    # ...narrative sources keep their human source string.
    assert any(e.startswith("[Vantage Ridge AAPL pre-call thesis note] ") for e in buf)


async def test_summarize_grounding_publishes_digest(stub_moss) -> None:
    """The periodic digest drains the buffer into one summarized grounding packet."""

    class _FakeStream:
        def __init__(self, text):
            self._text = text

        async def collect(self):
            return type("R", (), {"text": self._text})()

    class _SummaryLLM:
        def chat(self, *, chat_ctx, response_format=None, **kwargs):
            return _FakeStream("Your note models 12%; hold them to that number.")

    room = _FakeRoom()
    listener = DiligenceListener(
        room=room,
        user_id="fund_1",
        call_state=_sample_call(),
        verdict_llm=_SummaryLLM(),
    )
    listener._grounding_buffer = ["note: 12% contribution margin for Connect"]

    await listener._summarize_grounding(through_turn=8)

    pubs = room.local_participant.published
    assert len(pubs) == 1
    payload = json.loads(pubs[0][0].decode("utf-8"))
    assert payload["type"] == "grounding"
    assert payload["data"]["through_turn"] == 8
    assert "12%" in payload["data"]["summary"]
    # Buffer drained for the next window.
    assert listener._grounding_buffer == []


async def test_precompute_notes_populates_and_publishes(stub_moss) -> None:
    """At call start, each question gets concise source-tagged notes from Moss, and
    one coverage snapshot carrying them is published to the console."""

    class _FakeStream:
        def __init__(self, text):
            self._text = text

        async def collect(self):
            return type("R", (), {"text": self._text})()

    class _NotesLLM:
        def chat(self, *, chat_ctx, response_format=None, **kwargs):
            return _FakeStream("- Fact A — Q2 FY26 call\n- Fact B — AAPL 10-Q")

    class _Doc:
        def __init__(self, text, metadata):
            self.text = text
            self.metadata = metadata

    class _MossWithDocs:
        async def query(self, *args, **kwargs):
            return type(
                "R",
                (),
                {
                    "docs": [
                        _Doc(
                            "iPhone grew 22% year over year.",
                            {
                                "source": "Apple Q2 FY2026 earnings call",
                                "doc_type": "earnings_call",
                            },
                        )
                    ]
                },
            )()

    room = _FakeRoom()
    listener = DiligenceListener(
        room=room,
        user_id="fund_1",
        call_state=_sample_call(),
        verdict_llm=_NotesLLM(),
    )
    listener._moss = _MossWithDocs()

    await listener._precompute_notes()

    # Every question now carries parsed, source-tagged notes...
    assert listener._call.questions[0].notes == [
        "Fact A — Q2 FY26 call",
        "Fact B — AAPL 10-Q",
    ]
    # ...and one coverage snapshot was published carrying them.
    pubs = room.local_participant.published
    assert len(pubs) == 1
    payload = json.loads(pubs[0][0].decode("utf-8"))
    assert payload["type"] == "coverage_update"
    assert payload["data"]["questions"][0]["notes"] == [
        "Fact A — Q2 FY26 call",
        "Fact B — AAPL 10-Q",
    ]


async def test_precompute_notes_noop_without_llm(stub_moss) -> None:
    """No grader LLM (e.g. silence-only tests) -> no notes work, nothing published."""
    room = _FakeRoom()
    listener = DiligenceListener(room=room, user_id="fund_1", call_state=_sample_call())
    await listener._precompute_notes()
    assert room.local_participant.published == []
