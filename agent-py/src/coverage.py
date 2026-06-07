"""The coverage state machine — the spine of the diligence copilot.

Every pre-loaded diligence question lives in one of three states, and the
copilot's only goal is to drive them all to ``answered``::

    unanswered ──addressed──► partial ──follow-up closes it──► answered

This module owns the in-memory state of a single call: the question list (loaded
at session start), each question's coverage state plus the facts/contradictions
extracted for it, and the running thesis. The coverage engine (``B3``) mutates
this; the data-packet layer (``B5``) serialises ``snapshot()`` to the console.

The on-disk schema is the analyst-authored ``questions.json``::

    {
      "company": "Cirrus Logistics, Inc.", "ticker": "CRLG",
      "thesis": "...",
      "questions": [
        {"id": "q1", "pillar": "...", "question": "...",
         "complete_when": ["...", "..."], "expected": {...}, "state": "unanswered"}
      ]
    }

``complete_when`` (what a complete answer must contain) and ``expected`` (the
note-vs-variant view) are the spec the coverage engine grades against and the
ground for its follow-ups.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

# The three coverage states, ordered from least to most covered.
UNANSWERED = "unanswered"
PARTIAL = "partial"
ANSWERED = "answered"
COVERAGE_STATES = (UNANSWERED, PARTIAL, ANSWERED)


@dataclass
class QuestionState:
    """One diligence question and everything the call has surfaced for it."""

    id: str
    question: str
    pillar: str = ""
    # Criteria a complete answer must satisfy — the coverage engine grades the
    # researcher's answer against these to decide partial vs answered.
    complete_when: list[str] = field(default_factory=list)
    # The note-vs-variant view (e.g. {"note_models": "12%", "our_view": "18-20%"})
    # — grounds a sharp, specific follow-up when an answer comes back thin.
    expected: dict = field(default_factory=dict)
    state: str = UNANSWERED
    facts: list[str] = field(default_factory=list)
    contradictions: list[str] = field(default_factory=list)
    followup: str | None = None
    # Concise, source-tagged notes for this question, pulled from the Moss
    # knowledge corpus at call start (each a short "fact — source" line). Shown
    # when the analyst clicks the question on the console. See
    # DiligenceListener._precompute_notes.
    notes: list[str] = field(default_factory=list)

    def to_card(self) -> dict:
        """Serialise to the shape the analyst console renders."""
        return {
            "id": self.id,
            "question": self.question,
            "pillar": self.pillar,
            "state": self.state,
            "facts": list(self.facts),
            "contradictions": list(self.contradictions),
            "followup": self.followup,
            "notes": list(self.notes),
        }


@dataclass
class CallState:
    """The live state of one diligence call: the questions + the thesis."""

    thesis: str
    questions: list[QuestionState]
    company: str = ""
    ticker: str = ""

    @classmethod
    def from_dict(cls, data: dict) -> CallState:
        """Build from a parsed questions.json payload.

        Reads the analyst schema (``question``/``pillar``/``complete_when``/
        ``expected``); also accepts a plain ``text`` as the question for
        convenience. ``id`` defaults to ``q<index>``; questions with no question
        text are skipped; an out-of-range ``state`` falls back to ``unanswered``.
        Raises if no usable question remains.
        """
        questions: list[QuestionState] = []
        for index, raw in enumerate(data.get("questions", []), start=1):
            if not isinstance(raw, dict):
                continue
            text = str(raw.get("question") or raw.get("text") or "").strip()
            if not text:
                continue
            state = str(raw.get("state", UNANSWERED)).strip().lower()
            if state not in COVERAGE_STATES:
                state = UNANSWERED
            complete_when = [
                str(c).strip() for c in raw.get("complete_when", []) if str(c).strip()
            ]
            expected = raw.get("expected")
            # Optional authored notes (used as-is by the replay driver and as the
            # seed the live agent refreshes from Moss). Skipped if absent.
            notes = [str(n).strip() for n in raw.get("notes", []) if str(n).strip()]
            questions.append(
                QuestionState(
                    id=str(raw.get("id") or f"q{index}"),
                    question=text,
                    pillar=str(raw.get("pillar", "")).strip(),
                    complete_when=complete_when,
                    expected=expected if isinstance(expected, dict) else {},
                    state=state,
                    notes=notes,
                )
            )
        if not questions:
            raise ValueError("CallState requires at least one question with text.")
        return cls(
            thesis=str(data.get("thesis", "")).strip(),
            questions=questions,
            company=str(data.get("company", "")).strip(),
            ticker=str(data.get("ticker", "")).strip(),
        )

    @classmethod
    def from_file(cls, path: str | Path) -> CallState:
        """Load the pre-call question list + thesis from a JSON file."""
        with Path(path).open("r", encoding="utf-8") as handle:
            return cls.from_dict(json.load(handle))

    def by_id(self, question_id: str) -> QuestionState | None:
        """Return the question with this id, or None."""
        return next((q for q in self.questions if q.id == question_id), None)

    def counts(self) -> dict[str, int]:
        """How many questions sit in each coverage state."""
        tally = dict.fromkeys(COVERAGE_STATES, 0)
        for question in self.questions:
            tally[question.state] = tally.get(question.state, 0) + 1
        return tally

    def all_answered(self) -> bool:
        """True once every question has reached ``answered`` (no holes left)."""
        return all(q.state == ANSWERED for q in self.questions)

    def snapshot(self) -> dict:
        """Serialise the whole call state for the analyst console."""
        return {
            "company": self.company,
            "ticker": self.ticker,
            "thesis": self.thesis,
            "questions": [q.to_card() for q in self.questions],
            "counts": self.counts(),
        }


class QuestionUpdate(BaseModel):
    """The coverage engine's verdict for one question, from one researcher turn.

    Optional fields use ``""`` (not null) for "none" so the schema stays strict
    (all fields required) for json-schema-constrained decoding.
    """

    question_id: str
    coverage: Literal["unanswered", "partial", "answered"]
    extracted_facts: list[str]
    contradiction: str  # "" when none; else what the answer contradicts
    followup: str  # "" when none; else the gap-closing question to ask next


class TurnVerdict(BaseModel):
    """Every question update produced by a single researcher turn (possibly none)."""

    updates: list[QuestionUpdate]


def apply_verdict(call: CallState, verdict: TurnVerdict) -> list[str]:
    """Fold a turn's verdict into the call state; return the changed question ids.

    Coverage advances monotonically (a question never regresses), facts dedupe,
    contradictions append, and a follow-up is attached while a question is partial
    and cleared once it reaches ``answered``.
    """
    changed: list[str] = []
    for update in verdict.updates:
        question = call.by_id(update.question_id)
        if question is None:
            continue
        touched = False

        # Monotonic coverage: only advance toward answered, never regress.
        if COVERAGE_STATES.index(update.coverage) > COVERAGE_STATES.index(
            question.state
        ):
            question.state = update.coverage
            touched = True

        # Accumulate de-duplicated facts.
        for raw_fact in update.extracted_facts:
            fact = raw_fact.strip()
            if fact and fact not in question.facts:
                question.facts.append(fact)
                touched = True

        # Record any contradiction.
        contradiction = update.contradiction.strip()
        if contradiction and contradiction not in question.contradictions:
            question.contradictions.append(contradiction)
            touched = True

        # Attach a follow-up while partial; clear it once answered.
        if question.state == ANSWERED:
            if question.followup is not None:
                question.followup = None
                touched = True
        else:
            followup = update.followup.strip()
            if followup and followup != question.followup:
                question.followup = followup
                touched = True

        if touched:
            changed.append(question.id)
    return changed


def answer_line(verdict: TurnVerdict, max_facts: int = 3) -> str:
    """A one-line gist of what the researcher just said: the turn's extracted facts,
    de-duplicated and joined.

    Empty when the turn extracted no facts — operator hand-offs ("From Eric Woodring
    with Morgan Stanley."), filler ("Please go ahead."), and questions merely posed
    all grade to zero facts, so this skips them by construction. Drives the console's
    "THEY SAID" line (carried on the grounding packet), so the analyst sees a distilled
    answer rather than a raw, possibly-misdiarized transcript turn.
    """
    seen: set[str] = set()
    facts: list[str] = []
    for update in verdict.updates:
        for raw in update.extracted_facts:
            fact = raw.strip().rstrip(" .")
            if fact and fact not in seen:
                seen.add(fact)
                facts.append(fact)
    return "; ".join(facts[:max_facts])
