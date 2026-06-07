import asyncio
import contextlib
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
from engine import grade_turn

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


class SpeakerRoles:
    """Map diarization speaker ids to diligence-call roles.

    Speaker diarization (enabled on the STT) tags each turn with an opaque speaker
    id ("0", "1", ...); it does NOT know which voice is the analyst. On a diligence
    call the analyst opens and drives the Q&A, so the heuristic here binds the
    FIRST distinct speaker to ``"analyst"`` and every later speaker to
    ``"researcher"`` (the management / C-suite being grilled). The mapping is
    sticky, so a speaker keeps its role for the rest of the call.

    A missing id — no diarization, or a turn the STT couldn't attribute — maps to
    ``"researcher"``. That preserves the pre-diarization default of treating every
    turn as a researcher answer, which is the safe fallback for coverage (the
    grading engine only advances a question on a satisfying answer, so a
    mislabeled analyst turn can't false-advance it).

    This is a single-mic heuristic. When the analyst and researcher join as
    separate LiveKit participants, prefer labeling by participant identity (no
    diarization needed) — see docs.
    """

    def __init__(self) -> None:
        self._roles: dict[str, str] = {}

    def role_for(self, speaker_id: str | None) -> str:
        if speaker_id is None:
            return "researcher"
        role = self._roles.get(speaker_id)
        if role is None:
            role = "analyst" if not self._roles else "researcher"
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
                self._spawn(self._score_turn(text))
        raise StopResponse()

    def _spawn(self, coro) -> None:
        """Fire-and-forget a background task, retained until it completes."""
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _score_turn(self, text: str) -> None:
        """Score one researcher turn and fold the verdict into the call state.

        Runs out-of-band (the copilot never speaks). Degrades gracefully on
        error so a bad turn never crashes the call.
        """
        # Retrieve the analyst's own research context for what was just said, so
        # the engine can ground contradictions + follow-ups in the note's real
        # figures. Empty string if retrieval finds nothing or fails.
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

    async def _ground(self, query: str) -> str:
        """Retrieve the most relevant research/memo context for a researcher turn.

        Queries the Moss `knowledge` index and publishes a `grounding` packet for
        the console's grounding feed. Returns the joined snippet text for the
        engine to cite. Guarded: returns "" on failure so scoring still proceeds.
        """
        try:
            result = await self._moss.query(
                KNOWLEDGE_INDEX, query, QueryOptions(top_k=3)
            )
        except Exception:
            logger.exception("Moss grounding query failed")
            return ""

        snippets: list[str] = []
        matches: list[dict] = []
        for doc in getattr(result, "docs", None) or []:
            text = (getattr(doc, "text", "") or "").strip()
            if not text:
                continue
            snippets.append(text)
            entry: dict = {"text": text}
            score = getattr(doc, "score", None)
            if score is not None:
                with contextlib.suppress(TypeError, ValueError):
                    entry["score"] = float(score)
            matches.append(entry)

        if matches:
            await self._publish("grounding", {"query": query, "matches": matches})
        return "\n\n".join(snippets)

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
