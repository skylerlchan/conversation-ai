'use client';

import { useEffect, useMemo } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession, useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { MissionConsoleView } from '@/components/console/mission-console';
import { useLiveDiligence } from '@/hooks/useLiveDiligence';
import { getSandboxTokenSource } from '@/lib/utils';

/**
 * Inside the room context: connect on mount, then render the console straight off
 * the live agent's data packets. No transport (the call is real-time, not a replay).
 */
function LiveConsoleInner() {
  const session = useSessionContext();
  const model = useLiveDiligence();

  useEffect(() => {
    if (!session.isConnected) {
      // Joining the room is what lets us receive the agent's data packets. Mic
      // publish may require a gesture; failure here is non-fatal for data receipt.
      void session.start().catch(() => {});
    }
  }, [session]);

  return <MissionConsoleView model={model} />;
}

/**
 * The live analyst console: the diligence copilot wired to the LiveKit room. The
 * Python agent (DiligenceListener) — or the fake-live driver — publishes
 * coverage/grounding/transcript packets that drive the same console UI as the demo.
 */
export function LiveConsoleApp({ appConfig }: { appConfig: AppConfig }) {
  const tokenSource = useMemo(() => {
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig)
      : TokenSource.endpoint('/api/token');
  }, [appConfig]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  return (
    <AgentSessionProvider session={session}>
      <LiveConsoleInner />
      <StartAudioButton label="Start Audio" />
    </AgentSessionProvider>
  );
}
