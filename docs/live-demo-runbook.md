# Live Demo Runbook — real earnings call → live coverage board

Created: 2026-06-06 22:03 PDT

The "video in the background" demo: play the **real CAVA Q1 2026 earnings call**, and the
console fills in live — questions tick green, follow-ups fire, the model's assumptions get
challenged in real time. Everything on screen is driven by the actual call audio through the
real backend (LiveKit Inference STT → coverage engine).

Source video: [$CAVA CAVA Group Q1 2026 Earnings Conference Call](https://www.youtube.com/watch?v=bsmafLsLmEc)

---

## What the audience sees

| Panel | What it shows |
|---|---|
| **Command bar** | `● LIVE · CAVA · Live earnings call` + the `done / missed` coverage gauge |
| **Coverage** (left) | the 8 diligence questions as **Missed** / **Completed**; the thin one shows an `ASK NEXT` card |
| **Next step** (center) | the single grounded follow-up to ask now (e.g. *"You said +6.8% traffic — what was the full comp split?"*) |
| **Live call** (center) | the live transcript streaming off the audio |
| **Your model · assumptions** (right) | the fund's modeled numbers (`~$2.6M AUV`, `traffic-led comp`, …); a row turns **red / CHALLENGED** when the call contradicts it |

The money moment: management states a number that diverges from the model → the matching
assumption flashes red and a flag fires, **live, off the real call.**

---

## Pipeline (what's actually running)

```
YouTube call audio ──► LiveKit Inference STT (deepgram/nova-3, real-time)
                         │  finalized transcript chunks
                         ▼
                  coverage engine (engine.grade_turn, gpt-5.2 via LiveKit Inference)
                         │  scores each chunk vs the question list + the model
                         ▼
                  coverage snapshot ──POST──► /api/live ──poll──► /live console
```

Same engine the production agent (`agent.py`) uses; this runner just feeds it a file and
posts snapshots over HTTP (zero-setup, reliable on stage). The LiveKit data-packet path
(`agent.py` → `useLiveCoverage`) is the production transport.

---

## Setup (one-time)

1. `agent-py/.env.local` has `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (STT/LLM bill through LiveKit).
2. `frontend/.env.local` has the same `LIVEKIT_*` (+ `FMP_API_KEY` for the on-demand `/console`).
3. Download the call audio (once, ~113 MB wav, gitignored):
   ```bash
   cd agent-py/demo
   yt-dlp -f bestaudio -x --audio-format wav --postprocessor-args "ffmpeg:-ar 16000 -ac 1" \
     -o "audio/cava_earnings_q1_2026.%(ext)s" "https://www.youtube.com/watch?v=bsmafLsLmEc"
   ```

## Run it (2 terminals)

**Terminal 1 — frontend**
```bash
cd frontend && pnpm dev          # then open http://localhost:3001/live
```

**Terminal 2 — the live runner** (and start the YouTube video for the audience)
```bash
cd agent-py
uv run python demo/run_live_call.py \
  --audio demo/audio/cava_earnings_q1_2026.wav \
  --questions demo/cava_questions_agent.json \
  --endpoint http://localhost:3001/api/live \
  --start-min 2          # skip the operator intro; omit for the whole call
```
- `--speed 1.0` is real time (sync with the video). Use `--speed 4` to rehearse fast.
- `--max-min 12` to stop after the prepared remarks.

`/live` shows "Waiting for the call" until the first chunk is graded, then fills in live.

---

## The 90-second script (narration over the live board)

> **SETUP (before talking):** `/live` open, showing the 8 questions all grey and the model
> assumptions on the right. Start the video + runner.

1. **(0:00) Frame it.** "This is a buy-side analyst on CAVA's *live* earnings call. Eight
   questions they need answered, and their model — these assumptions on the right. The copilot
   listens; it never speaks, never trades."
2. **(0:15) It starts ticking.** As the CEO talks, questions move grey → green. "It's
   transcribing the real call and scoring every question in real time."
3. **(0:35) The thin answer.** A question goes amber with an `ASK NEXT` card. "He gave traffic
   but not the full comp split — it stays thin and writes the exact follow-up to ask."
4. **(0:50) The challenge (hero).** A model assumption flashes **red / CHALLENGED** + a flag.
   "Here's the moment. What he just said contradicts our model — *we'd have missed that live.*
   It caught it and grounded it against our own number."
5. **(1:10) Zero holes.** Gauge climbs toward all-green. "By the end of the call, every
   question is covered or flagged. The analyst walks away with no holes — and a list of exactly
   what to push on."
6. **(1:25) The line.** "Go in with your questions. Leave with zero holes."

---

## Notes

- The coverage is **real** — it's whatever the actual call says, not a script. Rehearse once to
  learn where the good moments land, and pick a `--start-min` that hits them.
- `agent-py/demo/cava_questions_agent.json` is the question list + model. Swap it (or point
  `--questions` elsewhere) to demo a different name.
- For a perfectly-scripted backup, the synthetic CAVA diligence call
  (`demo/audio/cava_call_full.wav` + `demo/cava_call.json`) hits the exact `$2.6M → $2.4M` and
  traffic-vs-price beats every time.
