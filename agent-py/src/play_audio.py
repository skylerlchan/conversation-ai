"""Publish a recorded call into a LiveKit room as a participant audio track.

This "pretends" a real earnings-call recording is the person on the diligence
call: it joins the room as a participant ("researcher") and publishes the audio
as a live track. The agent (DiligenceListener) subscribes, runs STT + turn
detection + coverage grading, and the analyst console (/console/live) ticks in
real time — exactly the live path, fed by real audio instead of a mic.

The room must match the one the frontend joined. Set DEMO_ROOM in both
frontend/.env.local and the agent so all three (frontend, agent, this driver)
meet in one fixed room.

  uv run src/play_audio.py --file demo/realaudio/segment_cook.wav --room diligence-live
"""

import argparse
import asyncio
import os
import wave
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(".env.local")

AGENT_ROOT = Path(__file__).resolve().parent.parent
FRAME_MS = 10  # 10ms frames is the standard capture granularity


async def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a WAV recording into a LiveKit room as audio.")
    parser.add_argument("--file", required=True, help="16-bit PCM WAV to publish")
    parser.add_argument("--room", default=os.getenv("DEMO_ROOM", "diligence-live"))
    parser.add_argument("--identity", default="researcher")
    parser.add_argument("--name", default="Earnings call")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.is_absolute():
        path = AGENT_ROOT / path
    wf = wave.open(str(path), "rb")
    sr, ch, width = wf.getframerate(), wf.getnchannels(), wf.getsampwidth()
    if width != 2:
        raise SystemExit(f"expected 16-bit PCM WAV, got sample width {width}")

    # Imported lazily so the module loads without the SDK (mirrors fake_live.py).
    from livekit import api, rtc

    url = os.environ["LIVEKIT_URL"]
    token = (
        api.AccessToken(os.environ["LIVEKIT_API_KEY"], os.environ["LIVEKIT_API_SECRET"])
        .with_identity(args.identity)
        .with_name(args.name)
        .with_grants(api.VideoGrants(room_join=True, room=args.room))
        .to_jwt()
    )

    room = rtc.Room()
    await room.connect(url, token)
    print(f"connected to room '{args.room}' as '{args.identity}' — {sr}Hz x{ch}ch")

    # queue_size_ms gives ~1s of buffering: after it fills, capture_frame awaits,
    # which paces publishing to real time (the recording plays at natural speed).
    source = rtc.AudioSource(sr, ch, queue_size_ms=1000)
    track = rtc.LocalAudioTrack.create_audio_track("call-audio", source)
    await room.local_participant.publish_track(
        track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    )
    print("publishing audio in real time… (Ctrl-C to stop)")

    samples_per_frame = int(sr * FRAME_MS / 1000)
    frames = 0
    while True:
        data = wf.readframes(samples_per_frame)
        if not data:
            break
        n = len(data) // (2 * ch)
        if n < samples_per_frame:  # pad the short final frame with silence
            data = data + b"\x00" * ((samples_per_frame - n) * 2 * ch)
            n = samples_per_frame
        await source.capture_frame(
            rtc.AudioFrame(data=data, sample_rate=sr, num_channels=ch, samples_per_channel=n)
        )
        frames += 1

    print(f"captured {frames} frames (~{frames * FRAME_MS / 1000:.0f}s); draining buffer…")
    await source.wait_for_playout()
    await asyncio.sleep(1.0)
    await room.disconnect()
    print("done")


if __name__ == "__main__":
    asyncio.run(main())
