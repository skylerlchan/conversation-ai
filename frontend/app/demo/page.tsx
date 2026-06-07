import type { Metadata } from 'next';
import { DiligenceConsole } from '@/components/diligence/diligence-console';

export const metadata: Metadata = {
  title: 'Diligence Copilot — CAVA demo',
  description:
    'Replay of a scripted buy-side diligence call: coverage tracking, grounded follow-ups, and inconsistency flags in real time.',
};

export default function DemoPage() {
  return <DiligenceConsole />;
}
