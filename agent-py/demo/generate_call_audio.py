#!/usr/bin/env python3
"""Render the scripted CAVA diligence call (cava_call.json) to audio.

Demo scaffolding for Argus: turns the golden transcript into an actual two-voice
recording so the team can (a) play a realistic call on stage and (b) feed it
into the LiveKit room / coverage engine for end-to-end testing.

Outputs (under demo/audio/):
  cava_call_full.mp3        - the whole call, both voices, ready to play/pipe
  cava_call_full.wav        - same, uncompressed (for clean re-encoding)
  turns/turn_NN_<spk>.wav   - one clip per turn (test the engine turn-by-turn)
  manifest.json             - per-turn speaker, start time, duration, question ids

Uses macOS `say` for TTS and `ffmpeg` for stitching — no API keys, fully local.
Swap VOICES / RATE / GAP below to retune. Re-run after editing cava_call.json.

  python3 agent-py/demo/generate_call_audio.py
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import wave
from pathlib import Path

# --- Casting & pacing (tweak freely) --------------------------------------- #
# Distinct voices so the two speakers are unmistakable. macOS natural voices
# available here: Samantha (en_US, f), Daniel (en_GB, m), Karen (en_AU, f).
# For a nicer demo, install Premium/Enhanced voices in System Settings ->
# Accessibility -> Spoken Content -> Manage Voices, then put the name here.
VOICES = {
    "analyst": "Samantha",     # buy-side analyst (the customer running the call)
    "researcher": "Daniel",    # sell-side equity research analyst being grilled
}
RATE_WPM = 178                 # `say -r` words per minute (~natural call pace)
GAP_SECONDS = 0.65             # silence between turns
HANDOFF_EXTRA = 0.25           # extra pause when the speaker changes (more natural)
SAMPLE_RATE = 44100

HERE = Path(__file__).resolve().parent
CALL_JSON = HERE / "cava_call.json"
OUT_DIR = HERE / "audio"
TURNS_DIR = OUT_DIR / "turns"


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def _wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def _make_silence(path: Path, seconds: float) -> None:
    _run([
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"anullsrc=r={SAMPLE_RATE}:cl=mono",
        "-t", f"{seconds:.3f}", str(path),
    ])


def _say_to_wav(text: str, voice: str, out_wav: Path, tmp: Path) -> None:
    """Synthesize `text` in `voice` to a normalized mono WAV."""
    aiff = tmp / "turn.aiff"
    _run(["say", "-v", voice, "-r", str(RATE_WPM), "-o", str(aiff), text])
    _run([
        "ffmpeg", "-y", "-i", str(aiff),
        "-ar", str(SAMPLE_RATE), "-ac", "1", str(out_wav),
    ])
    aiff.unlink(missing_ok=True)


def main() -> None:
    for tool in ("say", "ffmpeg"):
        if subprocess.run(["which", tool], capture_output=True).returncode != 0:
            raise SystemExit(f"required tool not found: {tool}")

    call = json.loads(CALL_JSON.read_text())
    turns = call["turns"]

    OUT_DIR.mkdir(exist_ok=True)
    TURNS_DIR.mkdir(exist_ok=True)

    with tempfile.TemporaryDirectory() as _td:
        tmp = Path(_td)
        gap = tmp / "gap.wav"
        handoff = tmp / "handoff.wav"
        _make_silence(gap, GAP_SECONDS)
        _make_silence(handoff, GAP_SECONDS + HANDOFF_EXTRA)

        concat_list = tmp / "concat.txt"
        lines: list[str] = []
        manifest: list[dict] = []
        clock = 0.0
        prev_speaker: str | None = None

        for turn in turns:
            spk = turn["speaker"]
            voice = VOICES.get(spk)
            if voice is None:
                raise SystemExit(f"no voice mapped for speaker {spk!r}")

            clip = TURNS_DIR / f"turn_{turn['t']:02d}_{spk}.wav"
            _say_to_wav(turn["text"], voice, clip, tmp)
            dur = _wav_duration(clip)

            # Pause before this turn (longer on a speaker change), except first.
            if prev_speaker is not None:
                pause = handoff if spk != prev_speaker else gap
                lines.append(f"file '{pause}'")
                clock += GAP_SECONDS + (HANDOFF_EXTRA if spk != prev_speaker else 0)
            lines.append(f"file '{clip}'")

            exp = turn.get("expected") or {}
            manifest.append({
                "t": turn["t"],
                "speaker": spk,
                "voice": voice,
                "clip": str(clip.relative_to(OUT_DIR)),
                "start_sec": round(clock, 2),
                "duration_sec": round(dur, 2),
                "addresses": exp.get("addresses") or turn.get("asks") or [],
                "coverage": exp.get("coverage"),
                "contradiction": bool(exp.get("contradiction")),
                "followup": bool(exp.get("followup")),
                "is_followup": bool(turn.get("is_followup_for")),
                "text": turn["text"],
            })
            clock += dur
            prev_speaker = spk
            print(f"  turn {turn['t']:02d}  {spk:10s} {voice:9s} {dur:5.1f}s")

        concat_list.write_text("\n".join(lines) + "\n")

        full_wav = OUT_DIR / "cava_call_full.wav"
        full_mp3 = OUT_DIR / "cava_call_full.mp3"
        _run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_list), "-c", "copy", str(full_wav),
        ])
        _run([
            "ffmpeg", "-y", "-i", str(full_wav),
            "-codec:a", "libmp3lame", "-b:a", "128k", str(full_mp3),
        ])

    total = _wav_duration(full_wav)
    (OUT_DIR / "manifest.json").write_text(json.dumps({
        "company": call.get("company"),
        "voices": VOICES,
        "rate_wpm": RATE_WPM,
        "gap_seconds": GAP_SECONDS,
        "total_seconds": round(total, 2),
        "turns": manifest,
    }, indent=2) + "\n")

    print(f"\nFull call: {full_mp3.relative_to(HERE.parent)}  ({total/60:.1f} min)")
    print(f"Per-turn clips: {TURNS_DIR.relative_to(HERE.parent)}/  ({len(turns)} clips)")
    print(f"Manifest: {(OUT_DIR / 'manifest.json').relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
