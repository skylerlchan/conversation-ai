import type { Metadata } from 'next';
import { LivePoll } from '@/components/console/live-poll';

export const metadata: Metadata = {
  title: 'Diligence Copilot — Live',
  description:
    'Live diligence call: the backend listens and drives the coverage board in real time.',
};

export default function Page() {
  return <LivePoll />;
}
