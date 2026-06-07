import type { Metadata } from 'next';
import { LiveCallConsole } from '@/components/console/livecall-console';

export const metadata: Metadata = {
  title: 'Diligence Copilot — Live call',
  description:
    'The live diligence console wired to the real backend: LiveKit STT transcribes the call audio live, Moss grounds each answer, and coverage ticks as the expert speaks. Receive-only (no mic).',
};

// Receive-only live console: joins the LiveKit room to render the agent's
// coverage/transcript/interim packets and play the call audio. No microphone.
export default function Page() {
  return <LiveCallConsole />;
}
