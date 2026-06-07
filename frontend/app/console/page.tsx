import type { Metadata } from 'next';
import { MissionConsole } from '@/components/console/mission-console';

export const metadata: Metadata = {
  title: 'Diligence Copilot — Console',
  description:
    'Live diligence-call console: coverage tracking, grounded follow-ups, and inconsistency flags in real time.',
};

export default function Page() {
  return <MissionConsole />;
}
