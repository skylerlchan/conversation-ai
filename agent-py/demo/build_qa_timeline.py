"""Build the time-synced Q&A demo: word-by-word transcript + the coverage beat.

Pretends the real Apple Q2 FY26 Q&A exchange (Eric Woodring of Morgan Stanley
asking about supply, Tim Cook answering) is a buy-side expert call. Produces a
timeline the console replays against the real audio clock:

  - `word` events     stream the transcript word-by-word (real Whisper word
                       timestamps), so it looks like live transcription.
  - `transcript`       commit a finished turn to history.
  - `coverage_update`  the question board ticks (q1 checks off when Cook names the
                       cause; q2, the magnitude Eric asked for, stays thin).
  - `thesis_delta`     the assumption that changes + what it means.

The coverage beat is hand-authored for the demo (timed to the real audio), not
engine-graded, so it is reliable on stage. The audio and word timing are real.
Copy is intentionally terse: this reads in real time.

    python3 agent-py/demo/build_qa_timeline.py
"""

from __future__ import annotations

import json
from pathlib import Path

DEMO = Path(__file__).resolve().parent
WORDS = DEMO / "realaudio" / "qa_words.json"
OUT = DEMO.parent.parent / "frontend" / "public" / "demo" / "qa"

COOK_START = 21.8  # first word of Cook's answer ("Yeah, hi Eric...")
TICKER, COMPANY = "AAPL", "Apple Inc."
THESIS = (
    "AAPL mid-supercycle: iPhone 17 demand outrunning supply. Pin where it's "
    "constrained, how big the gap is, and when it clears, before the hour runs out."
)

# Short, clear questions. q1 gets answered; q2 (the magnitude) never does (the
# miss); q3-q5 are topics still to cover, driving the time pressure.
QUESTIONS = [
    {"id": "q1", "pillar": "Supply", "question": "iPhone or Mac constrained?"},
    {"id": "q2", "pillar": "Supply", "question": "How big is the unmet demand?"},
    {"id": "q3", "pillar": "Supply", "question": "Is June still constrained?"},
    {"id": "q4", "pillar": "Margins", "question": "Gross margin trend?"},
    {"id": "q5", "pillar": "Forward", "question": "Services and AI durable?"},
]

ASK_ANSWER = (
    "Cook said supply is gated by advanced-node chip availability, mainly iPhone, "
    "shifting to Mac in June. He did not give the magnitude."
)


def card(q, state, facts=None, followup=None):
    return {
        "id": q["id"], "question": q["question"], "pillar": q["pillar"],
        "state": state, "facts": facts or [], "contradictions": [], "followup": followup,
    }


def snapshot(states: dict, facts: dict, followups: dict) -> dict:
    cards = [
        card(q, states.get(q["id"], "unanswered"), facts.get(q["id"]), followups.get(q["id"]))
        for q in QUESTIONS
    ]
    counts = {"unanswered": 0, "partial": 0, "answered": 0}
    for c in cards:
        counts[c["state"]] += 1
    return {"company": COMPANY, "ticker": TICKER, "thesis": THESIS, "questions": cards, "counts": counts}


def main() -> None:
    words = json.loads(WORDS.read_text(encoding="utf-8")).get("words", [])
    packets: list[dict] = []
    packets.append({"at": 0.0, "type": "coverage_update", "data": snapshot({}, {}, {})})

    eric, cook = [], []
    for w in words:
        text = w["word"].strip()
        start = round(float(w["start"]), 2)
        speaker = "analyst" if start < COOK_START else "researcher"
        (eric if speaker == "analyst" else cook).append(text)
        packets.append({"at": start, "type": "word", "data": {"turn": 1 if speaker == "analyst" else 2, "speaker": speaker, "w": text}})

    eric_text = " ".join(eric)
    cook_text = " ".join(cook)
    eric_end = round(COOK_START - 0.1, 2)
    cook_end = round(float(words[-1]["end"]), 2) if words else 43.0

    # Commit Eric's question; q2 (the magnitude he asked) becomes a tracked, open ask.
    packets.append({"at": eric_end, "type": "transcript", "data": {"t": 1, "speaker": "analyst", "text": eric_text}})
    packets.append({
        "at": eric_end, "type": "coverage_update",
        "data": snapshot(
            {"q2": "partial"},
            {"q2": ["Eric asked how big the unmet demand is, and whether June is still constrained"]},
            {"q2": "Not answered yet. Watch for a number, units or percent."},
        ),
    })

    # Cook answers: q1 raised (~26s), checked off when he names the cause (~31.5s).
    # q2 stays thin (no magnitude). q1's answer also flips an assumption.
    q2_facts = ["Eric asked how big the unmet demand is, and whether June is still constrained"]
    packets.append({
        "at": 26.0, "type": "coverage_update",
        "data": snapshot(
            {"q1": "partial", "q2": "partial"},
            {"q2": q2_facts, "q1": ["Constrained in the March quarter, mainly iPhone, less on Mac"]},
            {"q1": "Is it demand or supply? Get the root cause.", "q2": "Still no number. Push for units or percent."},
        ),
    })
    packets.append({
        "at": 31.5, "type": "coverage_update",
        "data": snapshot(
            {"q1": "answered", "q2": "partial"},
            {
                "q2": q2_facts,
                "q1": [
                    "Constrained in the March quarter, mainly iPhone, less on Mac",
                    "Root cause is advanced-node chip supply for their SOCs",
                ],
            },
            {"q2": "Eric asked how big the gap is. Cook gave the where, not the how much. Push for units or percent."},
        ),
    })
    packets.append({
        "at": 31.5, "type": "thesis_delta",
        "data": {
            "questionId": "q1",
            "field": "Supply constraint",
            "from": "Transient, demand led",
            "to": "Structural, capped by chip supply",
            "means": "Units are capped by advanced-node chip supply, not demand. Model the upside as supply gated.",
        },
    })

    packets.append({"at": cook_end, "type": "transcript", "data": {"t": 2, "speaker": "researcher", "text": cook_text}})

    packets.sort(key=lambda p: (p["at"], {"word": 0, "transcript": 1, "coverage_update": 2, "thesis_delta": 3}[p["type"]]))

    OUT.mkdir(parents=True, exist_ok=True)
    timeline = {
        "audio": "/demo/qa/qa.mp3",
        "ticker": TICKER,
        "company": COMPANY,
        "minutesLeft": 6,
        "askAnswer": ASK_ANSWER,
        "source": "Apple Q2 FY26 earnings call Q&A — Eric Woodring (Morgan Stanley) to Tim Cook (real audio)",
        "packets": packets,
    }
    (OUT / "timeline.json").write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    print(f"wrote {len(packets)} packets ({len(words)} words) to {OUT/'timeline.json'}")


if __name__ == "__main__":
    main()
