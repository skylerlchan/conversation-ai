# Diligence-Call Copilot — CAVA demo fixtures

Created: 2026-06-06 16:44 PDT

The demo material for the [Diligence-Call Copilot plan](../../docs/diligence-call-copilot-plan.md):
the pre-call question list, the grounding corpus, and a fully scripted diligence call that
exercises the whole coverage state machine. Demo company is **CAVA Group (NYSE: CAVA)** —
legible to any judge, clean bull thesis, and one diligence question that obviously goes thin.

> **All fixtures are synthetic.** Numbers are illustrative, the "Meridian Securities" research
> note is fictional, and nothing here is investment advice or a real CAVA disclosure. This is
> demo + test data, exactly the "pre-loaded structured inputs" the plan says to mock for a 24h
> build.

## Files

| File | What it is | Used by |
|---|---|---|
| [cava_questions.json](cava_questions.json) | The fund's 8 pre-call questions + thesis + the **modeled assumptions** the copilot grounds follow-ups and flags against | Pre-load at session start (`recall_facts` / question list); demo screen |
| [cava_corpus.json](cava_corpus.json) | Grounding corpus: fictional research-note excerpts + 10-K-style facts. Each chunk grounds a question | Future Moss `knowledge` index seed; the source of "what their note says" |
| [cava_call.json](cava_call.json) | The scripted call. Every researcher turn carries an `expected` coverage verdict (the **golden file**) | The stage script; `tests/test_demo_transcript.py`; future coverage-engine grading |
| [cava_call.md](cava_call.md) | Human-readable transcript with the copilot's live actions in the margin | Read this on stage / to understand the arc |
| [generate_call_audio.py](generate_call_audio.py) | Renders `cava_call.json` to a two-voice recording (macOS `say` + `ffmpeg`, no API keys) | `python3 demo/generate_call_audio.py` |
| [audio/cava_call_full.mp3](audio/cava_call_full.mp3) | The recorded call (~4.2 min): analyst = Samantha, researcher = Daniel | Play on stage / pipe into the LiveKit room |
| [audio/manifest.json](audio/manifest.json) | Per-turn speaker, **start timestamp**, duration, and coverage event | Sync the cards to the audio; test the engine turn-by-turn |
| [cava_financials/](cava_financials/) | **Real** CAVA financial data + earnings transcripts (FMP) | Factual corpus behind the demo |
| [`../tests/test_demo_transcript.py`](../tests/test_demo_transcript.py) | 15 golden/consistency tests over the fixtures | `uv run pytest tests/test_demo_transcript.py` |

## Audio (the recorded call)

`generate_call_audio.py` turns the golden script into an actual recording so you can play a
realistic call on stage and feed it into the LiveKit room / coverage engine for end-to-end
testing — no live reader needed. Run it any time you edit `cava_call.json`:

```bash
python3 agent-py/demo/generate_call_audio.py
```

Outputs land in `audio/`: the full call (`cava_call_full.mp3`), one clip per turn under
`turns/` (test the engine turn-by-turn), and `manifest.json` mapping each turn to its start
time and the coverage event that should fire. The demo beats land at:

| Time | Beat |
|---|---|
| ~1:05 | Q2 goes **amber**, the grounded follow-up fires (hero) |
| ~1:35 | Q2 closes **green** |
| ~2:05 | Q4 answers green but the **inconsistency flag** fires |
| ~3:47 | Q7 closes after the **nudge** — all green |

Voices are macOS built-ins (Samantha / Daniel). For a higher-quality demo, install
Premium/Enhanced voices (System Settings → Accessibility → Spoken Content → Manage Voices) or
swap in Cartesia/ElevenLabs and update `VOICES` in the generator. Only the mp3 + manifest are
committed; the bulky wavs are git-ignored and regenerate from the script.

## The demo arc (what the 8 questions are designed to do)

| Q | Topic | Role in the demo |
|---|---|---|
| Q1 | Unit-growth pipeline | clean green |
| **Q2** | **New-unit economics / cohort maturation** | **HERO** — vague answer -> amber -> copilot fires a grounded follow-up -> closes green (a hair below model) |
| Q3 | Restaurant-level margin durability | clean green |
| **Q4** | **Traffic vs price split** | **INCONSISTENCY** — answers green but contradicts the note's traffic-led model; flag fires |
| Q5 | Loyalty relaunch / digital mix | clean green |
| Q6 | Moat & pricing power | clean green (reinforces the Q4 flag) |
| **Q7** | **Catering / new formats** | **NUDGE** — sits grey until the copilot prompts with ~90s left, then closes |
| Q8 | Capital allocation / funding | clean green (brief) |

Two grounded "whoa" moments rest on chunks in `cava_corpus.json`:

- **Q2 follow-up** is grounded in `note-new-unit-econ` (note models **$2.6M** AUV / **~20%**
  year-one margin). The researcher dodges; the copilot pins him to the number; he concedes
  **~$2.4M / ~18%**.
- **Q4 flag** is grounded in `note-comp-quality` (note models **traffic-led** comp, ~5%
  traffic / ~3% price). The researcher says comp is **price-led** (double-digit price, flat
  traffic) — a direct contradiction of the published model.

By hang-up all 8 are green and the **thesis delta** (`cava_call.json` → `thesis_delta`)
auto-summarizes the two assumptions that moved.

## How the test fixture works (golden file)

Each `researcher` turn in `cava_call.json` has an `expected` block — the coverage verdict the
engine should emit for that turn:

```json
"expected": {
  "addresses": ["Q4"],
  "coverage": { "Q4": "answered" },
  "extracted_facts": ["comp is price-led", "double-digit price", "traffic flat"],
  "contradiction": { "vs": "note", "detail": "Note models traffic-led comp..." },
  "followup": null,
  "thesis_delta": "Comp is price-led, not traffic-led — downgrade comp quality."
}
```

This matches the coverage-engine output contract in the plan
(`{ addresses_question_id, coverage, extracted_facts, contradiction, followup }`). Today the
tests validate the *script's* correctness — forward-only states, exactly one partial (Q2),
exactly one contradiction (Q4 vs note), Q7 nudged last, all-green close. When the engine is
built, replay these turns through it and assert its output matches each `expected` block.

## Run the tests

```bash
cd agent-py
uv run pytest tests/test_demo_transcript.py -v
```

15 tests, no Moss/LiveKit credentials or network required.

## Driving the live demo from these fixtures (when the engine exists)

1. Pre-load `cava_questions.json` as the coverage list at session start.
2. Seed Moss `knowledge` from `cava_corpus.json` (via `create_index.py` / Unsiloed in prod).
3. Feed the `analyst` + `researcher` turns from `cava_call.json` as the call audio
   (recorded, or a teammate reading the researcher's lines — lock this early per the plan).
4. The copilot scores each researcher turn and updates the console; the `expected` blocks are
   the ground truth for what each card should show.
