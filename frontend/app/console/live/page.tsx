import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LiveConsoleApp } from '@/components/console/live-mission-console';
import { getAppConfig } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Brox — Live',
  description:
    'The live diligence-call console: coverage, grounded follow-ups, and inconsistency flags streamed from the agent in real time.',
};

// Connects to the LiveKit room and renders the console off the live agent's data
// packets. The demo replay lives at /console; this is the wired live path.
export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  return <LiveConsoleApp appConfig={appConfig} />;
}
