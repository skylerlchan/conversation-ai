import type { Metadata } from 'next';
import { RealCallConsole } from '@/components/console/realcall-console';

export const metadata: Metadata = {
  title: 'Diligence Copilot — Real call',
  description:
    'The diligence console driven by a real earnings-call recording: real transcription streams in and coverage ticks on real engine verdicts, synced to the audio.',
};

// Plays the real Apple earnings-call audio and replays the pre-computed
// (real STT + real coverage engine) timeline in sync. No mic, no TTS.
export default function Page() {
  return <RealCallConsole />;
}
