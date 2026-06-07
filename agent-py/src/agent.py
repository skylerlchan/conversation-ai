import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    StopResponse,
    cli,
    inference,
    room_io,
)
from livekit.plugins import ai_coustics, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from moss import MossClient, QueryOptions

from coverage import CallState, apply_verdict
from engine import grade_turn, summarize_grounding, summarize_question_notes

logger = logging.getLogger("agent")

load_dotenv(".env.local")

# Moss index names (overridable via env so create_index.py and the agent stay in
# sync). `knowledge` backs retrieval/grounding; `memory` is the per-call state
# store. See agent-py/src/create_index.py.
KNOWLEDGE_INDEX = os.getenv("MOSS_INDEX_NAME", "knowledge")
MEMORY_INDEX = os.getenv("MOSS_MEMORY_INDEX_NAME", "memory")

# Fallback identity used only when ctx.job.metadata is absent (e.g. when running
# `uv run src/agent.py console`). The frontend provides a real per-call user_id
# via agent dispatch metadata, which scopes the question list + notes.
DEFAULT_USER_ID = "user_1"

# The analyst-authored pre-call question list + thesis, loaded at session start.
# This is the spec for the whole call (see docs/diligence-call-copilot-plan.md).
QUESTIONS_PATH = Path(__file__).resolve().parent.parent / "questions.json"

# How often to surface a summarized notes/filings digest to the analyst. The
# grader still consumes retrieved context every turn (so contradictions surface
# live); only the analyst-facing digest is throttled to once per this many turns.
SUMMARY_EVERY = 8


def _source_label(meta: dict) -> str:
    """Compact, human source cite for a Moss knowledge snippet.

    Filings collapse to "<ticker> <doc_type> p.<pages>" (e.g. "AAPL 10-Q p.5");
    narrative sources (calls, analyst notes, regulatory news) use their human
    `source` string as-is. Returns "" when metadata carries nothing usable, so the
    snippet falls back to bare text and the digest can still cite something.
    """
    if not isinstance(meta, dict):
        return ""
    doc_type = (meta.get("doc_type") or "").strip()
    ticker = (meta.get("ticker") or "").strip()
    pages = (meta.get("pages") or "").strip()
    source = (meta.get("source") or "").strip()
    if doc_type in ("10-K", "10-Q"):
        label = " ".join(p for p in (ticker, doc_type) if p)
        return f"{label} p.{pages}" if pages else label
    return source or doc_type or ticker


class SpeakerRoles:
    """Map diarization speaker ids to diligence-call roles.

    Speaker diarization (enabled on the STT) tags each turn with an opaque speaker
    id ("0", "1", ...); it does NOT know which voice is the analyst. On a diligence
    call the analyst opens and drives the Q&A, so the heuristic here binds the
    FIRST TURN of the call to ``"analyst"`` (and that speaker id, if any, stays
    analyst) and every later speaker to ``"researcher"`` (the management / C-suite
    being grilled). The mapping is sticky, so a speaker keeps its role for the rest
    of the call.

    The opening turn is the analyst even with no id — no diarization, or a turn the
    STT couldn't attribute — so the console always opens on a "you" turn. Every
    *later* missing id maps to ``"researcher"``, the safe coverage fallback (the
    grading engine only advances a question on a satisfying answer, so a mislabeled
    turn can't false-advance it).

    This is a single-mic heuristic. When the analyst and researcher join as
    separate LiveKit participants, prefer labeling by participant identity (no
    diarization needed) — see docs.
    """

    def __init__(self) -> None:
        self._roles: dict[str, str] = {}
        self._seen_turn = False

    def role_for(self, speaker_id: str | None) -> str:
        # The first voice on the call is the analyst ("you") — even when diarization
        # is off and the id is None. Binding the opening turn to "analyst" guarantees
        # the console opens on a YOU turn instead of defaulting the lead speaker to
        # the researcher (and back-routed audio, like the in-app earnings video,
        # always reads its first turn as the analyst).
        if not self._seen_turn:
            self._seen_turn = True
            if speaker_id is not None:
                self._roles[speaker_id] = "analyst"
            return "analyst"
        if speaker_id is None:
            return "researcher"
        role = self._roles.get(speaker_id)
        if role is None:
            role = "researcher"
            self._roles[speaker_id] = role
        return role


class DiligenceListener(Agent):
    """A silent listener on a diligence call — it transcribes, it never speaks.

    The diligence copilot rides on the analyst's side of a live call. It consumes
    each finalized researcher turn (via `on_user_turn_completed`), and will — in
    later steps — score question coverage, surface grounded follow-ups, and stream
    cards to the analyst console. It produces no spoken reply: the session is built
    with no LLM-reply path and no TTS, and `StopResponse` short-circuits the reply
    node as an explicit guarantee of silence.
    """

    def __init__(
        self,
        *,
        room=None,
        user_id: str = DEFAULT_USER_ID,
        call_state: CallState | None = None,
        verdict_llm: inference.LLM | None = None,
    ) -> None:
        super().__init__(
            instructions=(
                "You are a silent listener on a diligence call. You never speak. "
                "You observe what the researcher says and surface information to "
                "the analyst's screen."
            ),
        )
        self._room = room
        self._user_id = user_id
        self._moss = MossClient(
            os.getenv("MOSS_PROJECT_ID"), os.getenv("MOSS_PROJECT_KEY")
        )
        self._indexes_loaded = False
        # The pre-call question list + thesis for this call, loaded at session
        # start. Tests inject a CallState; live runs load questions.json.
        self._call = (
            call_state
            if call_state is not None
            else CallState.from_file(QUESTIONS_PATH)
        )
        # Finalized researcher turns, in order.
        self._turns: list[str] = []
        # Notes/filings snippets retrieved since the last analyst digest. Filled
        # every turn by `_ground`; drained every SUMMARY_EVERY turns into a
        # summarized `grounding` packet for the console (see `_summarize_grounding`).
        self._grounding_buffer: list[str] = []
        # Speaker diarization: map opaque STT speaker ids to call roles, and hold
        # the speaker id of the in-progress turn (set from user_input_transcribed,
        # consumed when the turn finalizes). See SpeakerRoles + on_enter.
        self._speaker_roles = SpeakerRoles()
        self._current_turn_speaker_id: str | None = None
        # The coverage engine's dedicated LLM (out-of-band; never speaks). When
        # None — e.g. unit tests that only check silence — per-turn scoring is
        # skipped. `_tasks` retains in-flight scoring tasks so they aren't GC'd.
        self._verdict_llm = verdict_llm
        self._tasks: set[asyncio.Task] = set()

    async def on_enter(self) -> None:
        logger.info(
            "Diligence call started: %d questions to cover",
            len(self._call.questions),
        )
        # Track who is speaking. Diarization tags each transcription with a
        # speaker id; we hold the latest so the finalized turn can be labeled
        # analyst vs researcher. Guarded so a missing session never breaks entry.
        try:
            self.session.on("user_input_transcribed", self._on_user_input_transcribed)
        except Exception:
            logger.exception("Could not subscribe to transcription events")
        # Preload both Moss indexes so the first retrieval is fast. Guarded: log
        # and continue on failure so retrieval can still retry the load on use.
        if not self._indexes_loaded:
            try:
                await self._moss.load_index(KNOWLEDGE_INDEX)
                await self._moss.load_index(MEMORY_INDEX)
                self._indexes_loaded = True
                logger.info(
                    "Loaded Moss indexes '%s' and '%s'", KNOWLEDGE_INDEX, MEMORY_INDEX
                )
            except Exception:
                logger.exception("Failed to preload Moss indexes; will retry on use")
        # Pull each question's concise source-tagged notes from the corpus in the
        # background, so a click on the console shows them without a round-trip.
        # Off the audio path; republishes coverage when the notes land.
        self._spawn(self._precompute_notes())

    def _on_user_input_transcribed(self, ev) -> None:
        """Remember the diarized speaker of the in-progress turn.

        The final transcript's speaker id wins (a turn is usually one speaker);
        it is consumed and cleared when the turn finalizes in
        ``on_user_turn_completed``. No-op when diarization is off (speaker_id is
        None), leaving the safe "researcher" default in place.
        """
        speaker_id = getattr(ev, "speaker_id", None)
        if getattr(ev, "is_final", False) and speaker_id is not None:
            self._current_turn_speaker_id = speaker_id

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        """Consume each finalized turn — and never reply.

        Records the turn, labels the speaker (analyst vs researcher) from
        diarization, publishes it to the console transcript, scores coverage in
        the background, then raises `StopResponse` so the agent produces no spoken
        reply. This node runs before reply generation, so raising here keeps the
        copilot silent even if an LLM is ever attached to the session.

        Speaker labeling: the STT runs with diarization on, so each turn carries a
        speaker id we map to a role via `SpeakerRoles` (first speaker = analyst,
        the rest = researcher; unknown = researcher). The label drives the
        transcript display only — coverage is still scored on every turn, so a
        mislabel never drops a real researcher answer. The grading engine only
        advances a question on a satisfying answer, so an analyst re-asking can't
        false-advance it either.
        """
        text = (new_message.text_content or "").strip()
        if text:
            self._turns.append(text)
            speaker = self._speaker_roles.role_for(self._current_turn_speaker_id)
            self._current_turn_speaker_id = None
            logger.info("turn (%d, %s): %s", len(self._turns), speaker, text)
            # Surface the turn to the console immediately, before scoring.
            await self.publish_transcript(len(self._turns), speaker, text)
            # Score coverage in the background so the turn pipeline stays fast
            # (no one waits on the AI — it never speaks).
            if self._verdict_llm is not None:
                self._spawn(self._score_turn(len(self._turns), text))
        raise StopResponse()

    def _spawn(self, coro) -> None:
        """Fire-and-forget a background task, retained until it completes."""
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _score_turn(self, turn_no: int, text: str) -> None:
        """Score one researcher turn and fold the verdict into the call state.

        Runs out-of-band (the copilot never speaks). Degrades gracefully on
        error so a bad turn never crashes the call. ``turn_no`` is the 1-based
        index of this turn, used to pace the periodic analyst digest.
        """
        # Retrieve the analyst's own research context for what was just said, so
        # the engine can ground contradictions + follow-ups in the note's real
        # figures. This runs every turn (contradictions surface live); the
        # snippets are buffered for the periodic digest below. "" if none/fails.
        grounding = await self._ground(text)
        try:
            verdict = await grade_turn(
                self._verdict_llm, self._call, text, grounding=grounding
            )
        except Exception:
            logger.exception("coverage engine failed to score a turn")
            return
        changed = apply_verdict(self._call, verdict)
        if changed:
            logger.info("coverage updated %s -> %s", changed, self._call.counts())
            await self.publish_coverage()

        # Surface a summarized notes/filings digest to the analyst periodically —
        # not on every turn. The grader already used this turn's grounding above,
        # so live contradiction-checking is unaffected.
        if turn_no % SUMMARY_EVERY == 0:
            self._spawn(self._summarize_grounding(turn_no))

    async def _ground(self, query: str) -> str:
        """Retrieve the most relevant research/memo context for a researcher turn.

        Queries the Moss `knowledge` index and returns the joined snippet text for
        the engine to cite this turn, and buffers the snippets for the periodic
        analyst digest (`_summarize_grounding`). Deliberately does NOT publish a
        per-turn grounding packet — the console sees a summary every SUMMARY_EVERY
        turns instead. Guarded: returns "" on failure so scoring still proceeds.
        """
        try:
            result = await self._moss.query(
                KNOWLEDGE_INDEX, query, QueryOptions(top_k=3)
            )
        except Exception:
            logger.exception("Moss grounding query failed")
            return ""

        snippets: list[str] = []
        for doc in getattr(result, "docs", None) or []:
            text = (getattr(doc, "text", "") or "").strip()
            if not text:
                continue
            snippets.append(text)
            # Buffer a source-tagged copy so the periodic digest can attribute
            # each fact (the grader still gets bare text via the return value).
            label = _source_label(getattr(doc, "metadata", None) or {})
            entry = f"[{label}] {text}" if label else text
            if entry not in self._grounding_buffer:
                self._grounding_buffer.append(entry)
        return "\n\n".join(snippets)

    async def _summarize_grounding(self, through_turn: int) -> None:
        """Publish a summarized notes/filings digest of the recent window.

        Drains the grounding buffer and publishes one `grounding` packet carrying
        an analyst-readable `summary` (not raw Moss matches). Degrades gracefully
        so a failed summary never disrupts the call.
        """
        # Atomic drain (no await between read and clear).
        snippets = self._grounding_buffer
        self._grounding_buffer = []
        if not snippets or self._verdict_llm is None:
            return
        try:
            summary = await summarize_grounding(self._verdict_llm, snippets)
        except Exception:
            logger.exception("grounding summary failed")
            return
        if summary:
            await self._publish(
                "grounding", {"summary": summary, "through_turn": through_turn}
            )

    async def _precompute_notes(self) -> None:
        """Pull concise, source-tagged notes for each question from Moss, once.

        For every question, retrieves the most relevant corpus snippets and
        distills them into a few "fact — source" lines stored on the question, so
        the console can show them the instant the analyst clicks. Runs out-of-band
        at call start; republishes coverage when done. Per-question failures are
        swallowed (the question just keeps its authored/seed notes).
        """
        if self._verdict_llm is None:
            return
        updated = False
        for question in self._call.questions:
            try:
                result = await self._moss.query(
                    KNOWLEDGE_INDEX, question.question, QueryOptions(top_k=5)
                )
            except Exception:
                logger.exception("Moss notes query failed for %s", question.id)
                continue
            snippets: list[str] = []
            for doc in getattr(result, "docs", None) or []:
                text = (getattr(doc, "text", "") or "").strip()
                if not text:
                    continue
                label = _source_label(getattr(doc, "metadata", None) or {})
                snippets.append(f"[{label}] {text}" if label else text)
            if not snippets:
                continue
            try:
                notes = await summarize_question_notes(
                    self._verdict_llm, question.question, snippets
                )
            except Exception:
                logger.exception("Notes summary failed for %s", question.id)
                continue
            if notes:
                question.notes = notes
                updated = True
        if updated:
            await self.publish_coverage()

    async def _publish(self, packet_type: str, data: dict) -> None:
        """Publish a typed data packet to the analyst console.

        The shape is contractual with the frontend parser: ``{type, data}`` where
        ``data`` carries a ``timestamp`` in epoch SECONDS (the frontend multiplies
        by 1000). Reliable delivery; guarded so a publish failure never disrupts
        the call.
        """
        if self._room is None:
            return
        try:
            payload = {
                "type": packet_type,
                "data": {
                    **data,
                    "timestamp": datetime.now(timezone.utc).timestamp(),
                },
            }
            encoded = json.dumps(payload, default=str).encode("utf-8")
            await self._room.local_participant.publish_data(
                payload=encoded, reliable=True
            )
        except Exception:
            logger.exception("Failed to publish %s data packet", packet_type)

    async def publish_coverage(self) -> None:
        """Push the full coverage snapshot (the question state machine) to the UI."""
        await self._publish("coverage_update", self._call.snapshot())

    async def publish_transcript(self, t: int, speaker: str, text: str) -> None:
        """Push one finalized turn of the live call to the console transcript.

        The console renders the labeled transcript from these packets (the live
        coverage/grounding feeds carry no transcript text). See
        docs/diligence-copilot-build-plan.md (transcript-source decision).
        """
        await self._publish("transcript", {"t": t, "speaker": speaker, "text": text})


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


# Keep the registered dispatch name as "agent-py": the frontend sets
# AGENT_NAME=agent-py to dispatch explicitly to this worker. Do not rename.
@server.rtc_session(agent_name="agent-py")
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Identify the call from agent dispatch metadata. The frontend packs
    # {"user_id": ...} into ctx.job.metadata; console mode has none, so we fall
    # back to DEFAULT_USER_ID. Parsed before ctx.connect() to stay off the
    # connection critical path.
    user_id = DEFAULT_USER_ID
    if ctx.job.metadata:
        try:
            meta = json.loads(ctx.job.metadata)
            user_id = meta.get("user_id", DEFAULT_USER_ID)
        except json.JSONDecodeError:
            logger.warning("ctx.job.metadata was not valid JSON; using default user_id")

    # Silent-listener pipeline: speech-to-text + turn detection only. There is
    # deliberately no LLM-reply path and no TTS — the copilot listens and never
    # speaks on the call. STT transcripts still flow to `on_user_turn_completed`.
    session = AgentSession(
        # STT is the copilot's ears: the live transcript the coverage engine reads.
        # Diarization tags each turn with a speaker id so the console can separate
        # the analyst's questions from the researcher's / C-suite's answers
        # (mapped to roles by SpeakerRoles). Single-mic heuristic; for separate
        # participants, label by participant identity instead.
        stt=inference.STT(
            model="deepgram/nova-3", language="en", extra_kwargs={"diarize": True}
        ),
        # Turn detection marks the end of each researcher turn — the trigger the
        # whole copilot rides on. See https://docs.livekit.io/agents/build/turns
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
    )

    # The coverage engine's dedicated LLM: out-of-band structured scoring, off the
    # room's audio path, so it can never speak on the call. gpt-4.1-mini grades a
    # turn in ~2s (vs ~5.5s for gpt-5.2-chat-latest) at the same verdict, and its
    # static prompt prefix prefix-caches on the gateway. See engine.grade_turn.
    verdict_llm = inference.LLM(model="openai/gpt-4.1-mini")

    listener = DiligenceListener(
        room=ctx.room, user_id=user_id, verdict_llm=verdict_llm
    )
    await session.start(
        agent=listener,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
            # The copilot never publishes audio — it is silent on the call.
            audio_output=False,
        ),
    )

    # Join the room. No spoken greeting: the copilot is a silent listener.
    await ctx.connect()

    # Push the initial coverage snapshot so the console renders the question list
    # (all grey/unanswered) the moment the call connects.
    await listener.publish_coverage()


if __name__ == "__main__":
    cli.run_app(server)
