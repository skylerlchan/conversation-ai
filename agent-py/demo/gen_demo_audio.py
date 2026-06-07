"""Generate per-turn TTS audio for the scripted demo call.

Reads the scripted call fixture (default: ``apple_call.json``) and synthesizes one
audio clip per turn with OpenAI TTS — a distinct voice for the analyst (you) and the
researcher (the expert). Clips land in ``frontend/public/demo/audio/`` so the Next.js
replay (``/console``) can play them, and each clip's end advances the coverage board,
keeping audio and the on-screen arc in lockstep.

Re-run this whenever the call script changes (per docs/demo-storyboard-v2.md).

    OPENAI_API_KEY=... python3 agent-py/demo/gen_demo_audio.py
    python3 agent-py/demo/gen_demo_audio.py --call apple_call.json --force

No third-party deps (stdlib urllib); ffprobe (optional) is used for clip durations.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEMO_DIR = Path(__file__).resolve().parent
# frontend/public/demo/audio — served at /demo/audio/<file> by Next.js.
FRONTEND_AUDIO_DIR = DEMO_DIR.parent.parent / "frontend" / "public" / "demo" / "audio"

TTS_URL = "https://api.openai.com/v1/audio/speech"
TTS_MODEL = "gpt-4o-mini-tts"

# Two voices + tone steering so the call sounds like a real diligence call, not a
# uniform read. Maya (analyst) is crisp and pressed for time; the researcher is a
# warm, expansive former operator who gets evasive when pinned on a number.
VOICES = {
    "analyst": {
        "voice": "nova",
        "instructions": (
            "You are Maya, a sharp buy-side hedge fund analyst on a paid diligence "
            "call. Speak crisply and with focus — professional, direct, a little "
            "pressed for time. You know your model cold."
        ),
    },
    "researcher": {
        "voice": "onyx",
        "instructions": (
            "You are a seasoned former Apple operations executive being interviewed "
            "on an expert-network call. Warm, confident, and expansive, with the easy "
            "authority of someone who has run the numbers — but a touch evasive and "
            "salesy when first asked to pin down a hard figure."
        ),
    },
}


def synthesize(text: str, speaker: str, api_key: str) -> bytes:
    """One TTS call → mp3 bytes for a single turn."""
    cfg = VOICES.get(speaker, VOICES["researcher"])
    payload = json.dumps(
        {
            "model": TTS_MODEL,
            "voice": cfg["voice"],
            "input": text,
            "instructions": cfg["instructions"],
            "response_format": "mp3",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TTS_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def duration_sec(path: Path) -> float | None:
    """Clip length via ffprobe, if available — used only for the manifest."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(path),
            ],
            capture_output=True, text=True, timeout=20,
        )
        return round(float(out.stdout.strip()), 2)
    except Exception:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--call", default="apple_call.json", help="call fixture in demo/")
    parser.add_argument("--out", default=str(FRONTEND_AUDIO_DIR), help="output dir for clips")
    parser.add_argument("--force", action="store_true", help="re-synthesize clips that already exist")
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("error: OPENAI_API_KEY is not set", file=sys.stderr)
        return 1

    call = json.loads((DEMO_DIR / args.call).read_text(encoding="utf-8"))
    turns = sorted(call.get("turns", []), key=lambda t: t.get("t", 0))
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    for turn in turns:
        t = turn["t"]
        speaker = turn.get("speaker", "researcher")
        text = (turn.get("text") or "").strip()
        name = f"turn_{t:02d}.mp3"
        path = out_dir / name
        if text and (args.force or not path.exists()):
            print(f"  turn {t:>2} [{speaker:<10}] synth… ", end="", flush=True)
            try:
                path.write_bytes(synthesize(text, speaker, api_key))
                print(f"{path.stat().st_size:>6} bytes")
            except urllib.error.HTTPError as e:
                print(f"\nerror on turn {t}: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:300]}", file=sys.stderr)
                return 1
        elif path.exists():
            print(f"  turn {t:>2} [{speaker:<10}] exists (skip)")
        manifest.append(
            {"t": t, "speaker": speaker, "file": name, "duration": duration_sec(path)}
        )

    (out_dir / "manifest.json").write_text(
        json.dumps({"call": args.call, "turns": manifest}, indent=2), encoding="utf-8"
    )
    print(f"\nwrote {len(manifest)} clips + manifest.json to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
