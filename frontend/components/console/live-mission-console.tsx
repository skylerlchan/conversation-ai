'use client';

import { useCallback, useMemo, useState } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession, useSessionContext } from '@livekit/components-react';
import { ArrowRightIcon, PhoneSlashIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { MissionConsoleView } from '@/components/console/mission-console';
import { useLiveDiligence } from '@/hooks/useLiveDiligence';
import { getSandboxTokenSource } from '@/lib/utils';

/**
 * Pre-connect gate. Connecting publishes the analyst's mic, and browsers block
 * getUserMedia without a user gesture — so the call must start from a click, not
 * a mount effect. Surfaces the real error instead of swallowing it.
 */
function StartCallGate({
  onStart,
  starting,
  error,
}: {
  onStart: () => void;
  starting: boolean;
  error: string | null;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#0a0b0f] px-6 text-zinc-200">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        <span className="font-mono text-[11px] font-medium tracking-[0.28em] text-zinc-400 uppercase">
          Diligence Copilot — Live
        </span>
      </div>
      <p className="max-w-sm text-center text-[15px] leading-relaxed text-zinc-400">
        Connecting joins the LiveKit room and turns on your mic so the copilot can hear the call
        and track coverage live.
      </p>
      <button
        onClick={onStart}
        disabled={starting}
        className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-black transition-transform hover:scale-[1.01] hover:bg-zinc-100 disabled:opacity-60"
      >
        {starting ? 'Connecting…' : 'Start call'}
        {!starting && <ArrowRightIcon weight="bold" className="size-4" />}
      </button>
      {error && (
        <p className="max-w-md text-center font-mono text-[12px] text-red-400">
          {error}. Check that you allowed microphone access, then retry.
        </p>
      )}
    </div>
  );
}

/**
 * Inside the room context: render the console straight off the live agent's data
 * packets once connected. No transport (the call is real-time, not a replay).
 */
function LiveConsoleInner() {
  const session = useSessionContext();
  const model = useLiveDiligence();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onStart = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      await session.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start the call');
    } finally {
      setStarting(false);
    }
  }, [session]);

  const onStop = useCallback(() => {
    if (typeof session.end === 'function') session.end();
  }, [session]);

  if (!session.isConnected) {
    return <StartCallGate onStart={onStart} starting={starting} error={error} />;
  }

  return (
    <div className="relative">
      <button
        onClick={onStop}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-red-300 transition-colors hover:bg-red-500/20"
      >
        <PhoneSlashIcon weight="bold" className="size-3.5" />
        END CALL
      </button>
      <MissionConsoleView model={model} />
    </div>
  );
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
