"""The coverage engine — score each researcher turn against the question list.

A small, explicit, low-temperature structured LLM step. Given one finalized
researcher turn plus the call's questions (each with its ``complete_when``
criteria and ``expected`` note-vs-variant view), it returns — for each question
the turn touched — the new coverage state, extracted facts, any contradiction,
and, when the answer is thin, the sharp follow-up that would close the gap.

This runs out-of-band on a dedicated ``inference.LLM`` (never on the room's audio
path, so it cannot speak on the call). It uses ``response_format`` for strict
json-schema-constrained decoding; ``apply_verdict`` folds the result into the
CallState. See the B0 design + livekit-agents 1.5.16 inference.LLM.chat.
"""

from __future__ import annotations

import json

from livekit.agents import inference
from livekit.agents.llm import ChatContext

from coverage import CallState, TurnVerdict

# The grading rules live in code (not a config) because the whole demo rides on
# them — explicit over clever for the safety-critical path.
_RULES = """\
You are the silent coverage engine for a buy-side analyst on a live diligence
call. You never speak to anyone. Given ONE thing the researcher just said, decide
which of the analyst's pre-loaded questions it addresses, and how well.

For each question the turn actually touches, return an update:
- coverage: "answered" ONLY if the answer is specific and satisfies ALL of that
  question's complete_when criteria; "partial" if the topic was raised but the
  answer is vague, hedged, dodged, or misses any complete_when criterion.
  If the turn does not touch a question at all, do NOT include it.
- extracted_facts: the concrete facts the researcher stated, as short standalone
  strings. Use [] when none.
- contradiction: if the answer contradicts that question's `expected` view or a
  fact established earlier, describe it in one line; otherwise "".
- followup: when coverage is "partial", the single sharpest gap-closing question
  to ask next — grounded in the SPECIFIC missing complete_when criterion and the
  `expected` view (cite the number the note models when relevant). Otherwise "".

Rules:
- A turn may address multiple questions, or none. Only include questions this
  turn actually addresses.
- Stay anchored to the analyst's question list. Never invent new questions.
- When unsure between "partial" and "answered", choose "partial". Coverage gaps
  are the product; never let a thin answer pass as answered.
- Never output a generic followup like "can you elaborate?" — name the specific
  missing piece.
- When RESEARCH CONTEXT (the analyst's own notes / filings) is provided, check
  the answer against it: cite the specific figure from it in a contradiction or
  to sharpen a followup (e.g. "the note models 12%; ask them to reconcile").
"""


def _questions_block(call: CallState) -> str:
    """Render the static question definitions (id/question/complete_when/expected).

    Deliberately omits the mutable ``current_state`` so this block is byte-stable
    across every turn of a call — it lives in the cacheable system prefix (see
    ``grade_turn``). The live coverage states are rendered separately by
    ``_states_block`` into the volatile user message.
    """
    lines: list[str] = []
    for q in call.questions:
        lines.append(f"- id: {q.id}")
        lines.append(f"  question: {q.question}")
        if q.complete_when:
            lines.append("  complete_when:")
            lines.extend(f"    - {c}" for c in q.complete_when)
        if q.expected:
            lines.append(f"  expected: {json.dumps(q.expected)}")
    return "\n".join(lines)


def _states_block(call: CallState) -> str:
    """Render the per-question current coverage state (changes during the call)."""
    return "\n".join(f"- {q.id}: {q.state}" for q in call.questions)


async def grade_turn(
    verdict_llm: inference.LLM,
    call: CallState,
    turn_text: str,
    grounding: str = "",
) -> TurnVerdict:
    """Score one researcher turn against the question list; return the verdict.

    ``grounding`` is optional research context retrieved from the analyst's own
    notes/filings (Moss) for what the researcher just said — when present, the
    engine grounds contradictions and follow-ups in the note's actual figures.
    """
    # Static prefix — rules + thesis + question definitions. Identical on every
    # turn of a call, so the inference gateway prefix-caches it (OpenAI auto-caches
    # stable prefixes >~1k tokens; verify via usage.prompt_cached_tokens). Keeping
    # the mutable coverage state, grounding, and turn out of here is what makes the
    # cache hit — any byte change in the prefix invalidates the whole cache.
    system = (
        f"{_RULES}\n\nTHESIS: {call.thesis}\n\nQUESTIONS:\n{_questions_block(call)}"
    )
    research = (
        f"RESEARCH CONTEXT (the analyst's notes / filings):\n{grounding}\n\n"
        if grounding.strip()
        else ""
    )
    # Volatile tail — current coverage + retrieved context + the new turn.
    user = (
        f"CURRENT COVERAGE:\n{_states_block(call)}\n\n"
        f"{research}"
        f"RESEARCHER JUST SAID:\n{turn_text}"
    )
    chat_ctx = ChatContext.empty()
    chat_ctx.add_message(role="system", content=system)
    chat_ctx.add_message(role="user", content=user)
    stream = verdict_llm.chat(chat_ctx=chat_ctx, response_format=TurnVerdict)
    response = await stream.collect()
    return TurnVerdict.model_validate_json(response.text)
