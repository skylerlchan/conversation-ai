import { headers } from 'next/headers';
import { App } from '@/components/app/app';
import { getAppConfig } from '@/lib/utils';

// The original LiveKit voice-agent starter, preserved here. The live
// Diligence Copilot will wire into this transport later.
export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <App appConfig={appConfig} />;
}
