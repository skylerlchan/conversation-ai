import type { Metadata } from 'next';
import { QaConsole } from '@/components/console/qa-console';

export const metadata: Metadata = {
  title: 'Diligence Copilot — Live Q&A',
  description:
    'The diligence console on a real Apple Q2 FY26 Q&A exchange: the transcript streams word-by-word in sync with the audio, the question board ticks, the assumption that changes surfaces, and the clock counts down.',
};

// Time-synced replay of the real analyst Q&A (Eric Woodring → Tim Cook): real
// audio + word-by-word transcript + the coverage beat. See qa-console.tsx.
export default function Page() {
  return <QaConsole />;
}
