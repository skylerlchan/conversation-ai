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
- coverage: "answered" when the researcher gives a real, on-point answer to the
  question — it need NOT tick every complete_when criterion verbatim, as long as it
  substantively responds. Use "partial" only when the answer is clearly thin:
  dodged, refused, openly evasive, or silent on a complete_when criterion that
  plainly matters. If the turn does not touch a question at all, do NOT include it.
- extracted_facts: the concrete facts the researcher stated, as short standalone
  strings. Use [] when none.
- contradiction: if the answer contradicts that question's `expected` view or a
  fact established earlier, describe it in one line; otherwise "".
- followup: when coverage is "partial", the single sharpest gap-closing question
  to ask next — grounded in the SPECIFIC missing complete_when criterion and the
  `expected` view (cite the number the note models when relevant). Otherwise "".

Rules:
- A turn changes a question's coverage only by ANSWERING it. Merely asking,
  posing, repeating, or rephrasing one of the analyst's questions — or naming its
  topic without giving any information — does NOT address it: omit that question
  entirely (no facts, no "partial", no "answered", no followup). Coverage advances
  only on the substantive answer that follows a question, never on the question
  being raised. On a diligence call the analyst asks; the researcher answers.
- A turn may address multiple questions, or none. Only include questions this
  turn actually answers.
- Stay anchored to the analyst's question list. Never invent new questions.
- For a real answer that is hard to call, when unsure between "partial" and
  "answered", choose "answered": give it the benefit of the doubt rather than
  holding it open. Still flag a real dodge or contradiction — but don't keep a
  substantive answer from going green. (This tie-break is only for genuine
  answers — never use it to green a question that was merely asked.)
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


# Analyst-facing digest of the research context. The grader consumes raw note/
# filing snippets every turn (so contradictions surface live); this turns the
# snippets seen across a window of turns into a short brief for the analyst's
# screen — surfaced periodically, not every turn (see DiligenceListener).
_SUMMARY_RULES = """\
You brief a buy-side analyst on a live diligence call. Below are excerpts from the
analyst's own research notes, filings, and call transcripts — each tagged with its
source in [brackets]. Pull only the load-bearing facts: the specific numbers and
claims worth holding the researcher to.

Output 2-3 terse bullets, most material first, one fact each. Format each as:
- <fact> — <source>
Keep each fact a short fragment: aim for 4-8 words, lead with the figure, drop
articles and filler (e.g. "iPhone +22% YoY, record cycle — Q2 FY26 call", not
"iPhone revenue grew 22% year over year, the strongest cycle in company history").
Cite the bracketed source, shortened (e.g. "AAPL 10-Q p.5", "Vantage note",
"Q2 FY26 call"). No preamble, no headers, no prose paragraphs. Drop any excerpt
with no concrete figure or claim. Never invent a number or a source."""


async def summarize_grounding(verdict_llm: inference.LLM, snippets: list[str]) -> str:
    """Summarize retrieved notes/filings snippets into an analyst-facing digest.

    Runs out-of-band on the same dedicated LLM as the grader (never on the audio
    path). Returns "" when there is nothing to summarize.
    """
    excerpts = "\n\n".join(s.strip() for s in snippets if s.strip())
    if not excerpts:
        return ""
    chat_ctx = ChatContext.empty()
    chat_ctx.add_message(role="system", content=_SUMMARY_RULES)
    chat_ctx.add_message(
        role="user", content=f"SOURCED EXCERPTS (each tagged [source]):\n{excerpts}"
    )
    stream = verdict_llm.chat(chat_ctx=chat_ctx)
    response = await stream.collect()
    return (response.text or "").strip()


# Per-question notes: when the analyst clicks a question on the console, they see
# the few load-bearing facts the corpus holds *for that question*. Built once at
# call start from the question's own Moss retrieval (see _precompute_notes).
_QUESTION_NOTES_RULES = """\
You prep a buy-side analyst on one diligence question. Below is that question,
then excerpts from the analyst's research notes, filings, and call transcripts —
each tagged with its source in [brackets]. Pull only the facts that bear directly
on THIS question: the specific numbers and claims worth raising or holding the
researcher to.

Output 2-3 terse bullets, most material first, one fact each. Format each as:
- <fact> — <source>
Keep each fact a short fragment: aim for 4-8 words, lead with the figure, drop
articles and filler (e.g. "GM 49.3% in March Q — AAPL 10-Q", not "March-quarter
company gross margin came in at 49.3%"). Cite the bracketed source, shortened
(e.g. "AAPL 10-Q p.5", "Vantage note", "Q2 FY26 call"). No preamble, no headers,
no prose. Drop any excerpt that doesn't bear on the question or has no concrete
figure. Never invent a number or source."""


def _parse_bullets(text: str) -> list[str]:
    """Split an LLM bullet block into clean note lines (leading marker stripped)."""
    notes: list[str] = []
    for line in (text or "").splitlines():
        line = line.strip().lstrip("-•* ").strip()
        if line:
            notes.append(line)
    return notes


async def summarize_question_notes(
    verdict_llm: inference.LLM, question: str, snippets: list[str]
) -> list[str]:
    """Distill a question's retrieved corpus snippets into concise sourced notes.

    Returns a list of short "fact — source" lines (newest/most material first),
    or [] when there is nothing usable. Runs out-of-band on the grader's LLM.
    """
    excerpts = "\n\n".join(s.strip() for s in snippets if s.strip())
    if not excerpts or not question.strip():
        return []
    chat_ctx = ChatContext.empty()
    chat_ctx.add_message(role="system", content=_QUESTION_NOTES_RULES)
    chat_ctx.add_message(
        role="user",
        content=f"QUESTION:\n{question.strip()}\n\nSOURCED EXCERPTS (each tagged [source]):\n{excerpts}",
    )
    stream = verdict_llm.chat(chat_ctx=chat_ctx)
    response = await stream.collect()
    return _parse_bullets(response.text or "")
