import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LiveConsole } from '@/components/console/live-console';
import { getAppConfig } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Diligence Copilot — Live',
  description: 'Live diligence call: the agent listens and drives the coverage board in real time.',
};

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  return <LiveConsole appConfig={appConfig} />;
}
