'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LocalParticipant, TokenSource, Track } from 'livekit-client';
import { useLocalParticipant, useSession, useSessionContext } from '@livekit/components-react';
import { ArrowRightIcon, MonitorPlayIcon, PhoneSlashIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { EarningsVideoHotkey } from '@/components/console/earnings-video-player';
import { MissionConsoleView } from '@/components/console/mission-console';
import { useLiveDiligence } from '@/hooks/useLiveDiligence';
import { getSandboxTokenSource } from '@/lib/utils';

// 'mic'  = analyst mic only · 'tab' = video-tab audio only · 'both' = mic + tab mixed.
type AudioSource = 'mic' | 'tab' | 'both';

/** Resources captured outside LiveKit that we must stop/close on END CALL. */
interface CaptureResources {
  ctx?: AudioContext;
  tracks: MediaStreamTrack[];
}

/**
 * Capture the audio of another browser tab via the screen-share picker. Chrome
 * requires `video: true` to offer tab capture, but we only want the audio, so the
 * video track is stopped immediately. The user picks the tab playing the video and
 * leaves "Share tab audio" on.
 *
 * macOS note: Chrome captures TAB audio reliably, but not whole-system / other-app
 * audio — so the earnings-call video has to play in a Chrome tab.
 */
async function captureTabAudio(): Promise<MediaStreamTrack> {
  const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  display.getVideoTracks().forEach((t) => t.stop());
  const [audio] = display.getAudioTracks();
  if (!audio) {
    display.getTracks().forEach((t) => t.stop());
    throw new Error(
      "No tab audio captured — pick the tab playing the video and keep 'Share tab audio' on"
    );
  }
  return audio;
}

/**
 * Mix several audio tracks into one via the Web Audio graph, so a single published
 * track carries both the analyst's mic and the video tab. The AudioContext and
 * source tracks must stay referenced for the life of the call (returned for cleanup).
 */
function mixAudioTracks(tracks: MediaStreamTrack[]): {
  mixed: MediaStreamTrack;
  ctx: AudioContext;
} {
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  for (const t of tracks) {
    ctx.createMediaStreamSource(new MediaStream([t])).connect(dest);
  }
  return { mixed: dest.stream.getAudioTracks()[0], ctx };
}

/**
 * Hot-swap the published microphone track's underlying audio for `track`. The agent
 * subscribes to the microphone-source track, so swapping the MediaStreamTrack (rather
 * than republishing) keeps that subscription intact. session.start() publishes the
 * mic asynchronously, so poll briefly for the publication, then replace + stop the
 * original mic track it created (we feed our own capture(s) instead).
 */
async function routeTrackToMic(
  localParticipant: LocalParticipant,
  track: MediaStreamTrack
): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
    if (micTrack && typeof micTrack.replaceTrack === 'function') {
      const original = micTrack.mediaStreamTrack;
      await micTrack.replaceTrack(track);
      if (original && original !== track && original.readyState === 'live') original.stop();
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    'Microphone track never published, so the audio could not be routed to the agent'
  );
}

/**
 * Pre-connect gate. Connecting publishes an audio track the agent transcribes, and
 * browsers block media capture without a user gesture — so the call starts from a
 * click. The primary path plays the baked-in earnings video and routes its audio
 * straight into the call (no screen-share picker). Advanced paths: mic, a browser
 * tab's audio, or both mixed.
 */
function StartCallGate({
  onConnect,
  onStart,
  starting,
  error,
}: {
  onConnect: () => void;
  onStart: (source: AudioSource) => void;
  starting: boolean;
  error: string | null;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-7 bg-[#0a0b0f] px-6 text-zinc-200">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        <span className="font-mono text-[11px] font-medium tracking-[0.28em] text-zinc-400 uppercase">
          Brox — Live
        </span>
      </div>
      <p className="max-w-md text-center text-[15px] leading-relaxed text-zinc-400">
        Brox listens to the call and tracks coverage live. Connect first — then press Space to
        start the in-app earnings video. Its audio streams into the call, transcribed live, and
        coverage fills in as the questions land.
      </p>
      <button
        onClick={onConnect}
        disabled={starting}
        className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-black transition-transform hover:scale-[1.01] hover:bg-zinc-100 disabled:opacity-60"
      >
        <MonitorPlayIcon weight="fill" className="size-4" />
        {starting ? 'Connecting…' : 'Connect to call'}
        {!starting && <ArrowRightIcon weight="bold" className="size-4" />}
      </button>
      <div className="flex items-center gap-4 font-mono text-[11px] text-zinc-500">
        <button onClick={() => onStart('mic')} disabled={starting} className="hover:text-zinc-300">
          Mic only
        </button>
        <span className="text-zinc-700">·</span>
        <button onClick={() => onStart('both')} disabled={starting} className="hover:text-zinc-300">
          Mic + browser tab
        </button>
        <span className="text-zinc-700">·</span>
        <button onClick={() => onStart('tab')} disabled={starting} className="hover:text-zinc-300">
          Browser tab only
        </button>
      </div>
      <p className="max-w-sm text-center font-mono text-[11px] leading-relaxed text-zinc-600">
        Chrome only. Once connected, press Space to start the earnings video (bottom-right);
        Space again to pause or resume.
      </p>
      {error && <p className="max-w-md text-center font-mono text-[12px] text-red-400">{error}</p>}
    </div>
  );
}

/**
 * Inside the room context: render the console straight off the live agent's data
 * packets once connected. No transport (the call is real-time, not a replay).
 */
function LiveConsoleInner() {
  const session = useSessionContext();
  const { localParticipant } = useLocalParticipant();
  const model = useLiveDiligence();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const capture = useRef<CaptureResources>({ tracks: [] });
  // In-app earnings-video routing state (see routeVideoAudio / onVideoPlay).
  const routed = useRef(false);
  const pendingVideo = useRef<HTMLVideoElement | null>(null);
  const graph = useRef<{
    ctx: AudioContext;
    source: MediaElementAudioSourceNode;
    track: MediaStreamTrack;
  } | null>(null);

  const onStart = useCallback(
    async (source: AudioSource) => {
      setError(null);
      setStarting(true);
      const res: CaptureResources = { tracks: [] };
      try {
        // Capture the extra sources in the same user gesture, before connecting.
        let routed: MediaStreamTrack | null = null;
        if (source === 'tab' || source === 'both') {
          const tab = await captureTabAudio();
          res.tracks.push(tab);
          if (source === 'tab') {
            routed = tab;
          } else {
            const mic = (
              await navigator.mediaDevices.getUserMedia({ audio: true })
            ).getAudioTracks()[0];
            res.tracks.push(mic);
            const { mixed, ctx } = mixAudioTracks([tab, mic]);
            res.ctx = ctx;
            await ctx.resume();
            routed = mixed;
          }
        }

        await session.start(); // connects + publishes the mic track
        if (routed) await routeTrackToMic(localParticipant, routed);
        capture.current = res;
      } catch (e) {
        res.tracks.forEach((t) => t.stop());
        res.ctx?.close();
        setError(e instanceof Error ? e.message : 'Failed to start the call');
      } finally {
        setStarting(false);
      }
    },
    [session, localParticipant]
  );

  // Connect only — do NOT auto-play the video. The agent needs to be connected and
  // subscribed before audio flows, otherwise the opening gets swallowed into one
  // giant turn that grades every question at once. Once connected, the analyst
  // presses Space to start the earnings video (that keystroke is the user gesture
  // the audio needs); onVideoPlay then routes its audio into the live call.
  const onConnect = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      await session.start(); // connect + publish the mic track we route onto
      capture.current = { tracks: [] };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start the call');
    } finally {
      setStarting(false);
    }
  }, [session]);

  const onStop = useCallback(() => {
    capture.current.tracks.forEach((t) => t.stop());
    capture.current.ctx?.close();
    capture.current = { tracks: [] };
    routed.current = false;
    pendingVideo.current = null;
    if (typeof session.end === 'function') session.end();
  }, [session]);

  // Wire the <video> through a Web Audio graph (the reliable WebRTC route, same as
  // mixAudioTracks; captureStream() is flaky over the peer connection): one branch is
  // a MediaStreamTrack swapped onto the published mic track -> agent STT; the other
  // feeds the speakers so the room still hears it. The graph is page-scoped
  // (createMediaElementSource runs once per element) and re-routed onto the mic each
  // call. No-op until the call is connected.
  const routeVideoAudio = useCallback(
    (video: HTMLVideoElement) => {
      if (routed.current || !session.isConnected) return;
      try {
        if (!graph.current) {
          const ctx = new AudioContext();
          const source = ctx.createMediaElementSource(video);
          source.connect(ctx.destination); // speakers — wired once
          const dest = ctx.createMediaStreamDestination();
          source.connect(dest);
          graph.current = { ctx, source, track: dest.stream.getAudioTracks()[0] };
        } else if (graph.current.track.readyState === 'ended') {
          // A prior call ended its sender's track; mint a fresh one from the source.
          const dest = graph.current.ctx.createMediaStreamDestination();
          graph.current.source.connect(dest);
          graph.current.track = dest.stream.getAudioTracks()[0];
        }
        routed.current = true;
        void graph.current.ctx.resume();
        void routeTrackToMic(localParticipant, graph.current.track).catch((e) => {
          routed.current = false;
          setError(e instanceof Error ? e.message : 'Could not route the video audio to the agent');
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not route the in-app video — use Chrome.');
      }
    },
    [session, localParticipant]
  );

  // The side player started. Route now if connected; otherwise route as soon as the
  // call connects (the one-click flow plays first, then connects).
  const onVideoPlay = useCallback(
    (video: HTMLVideoElement) => {
      pendingVideo.current = video;
      routeVideoAudio(video);
    },
    [routeVideoAudio]
  );

  useEffect(() => {
    if (session.isConnected && !routed.current && pendingVideo.current) {
      routeVideoAudio(pendingVideo.current);
    }
  }, [session.isConnected, routeVideoAudio]);

  return (
    <>
      {session.isConnected ? (
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
      ) : (
        <StartCallGate
          onConnect={onConnect}
          onStart={onStart}
          starting={starting}
          error={error}
        />
      )}
      <EarningsVideoHotkey onPlayStart={onVideoPlay} routedHint="→ agent live" />
    </>
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
