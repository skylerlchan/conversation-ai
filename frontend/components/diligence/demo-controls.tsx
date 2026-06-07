'use client';

import {
  ArrowCounterClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';

interface DemoControlsProps {
  cursor: number;
  total: number;
  playing: boolean;
  done: boolean;
  speedMs: number;
  onToggle: () => void;
  onStep: () => void;
  onBack: () => void;
  onRestart: () => void;
  onSetSpeed: (ms: number) => void;
}

const SPEEDS: { label: string; ms: number }[] = [
  { label: 'Slow', ms: 4000 },
  { label: 'Normal', ms: 2600 },
  { label: 'Fast', ms: 1400 },
];

export function DemoControls({
  cursor,
  total,
  playing,
  done,
  speedMs,
  onToggle,
  onStep,
  onBack,
  onRestart,
  onSetSpeed,
}: DemoControlsProps) {
  return (
    <div className="bg-card/80 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          disabled={cursor === 0}
          aria-label="Back"
        >
          <CaretLeftIcon weight="bold" />
        </Button>
        {done ? (
          <Button size="icon" onClick={onRestart} aria-label="Restart">
            <ArrowCounterClockwiseIcon weight="bold" />
          </Button>
        ) : (
          <Button size="icon" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onStep}
          disabled={done}
          aria-label="Step forward"
        >
          <CaretRightIcon weight="bold" />
        </Button>
      </div>

      <div className="text-muted-foreground min-w-[5rem] text-xs tabular-nums">
        Turn {Math.min(cursor, total)} / {total}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="text-muted-foreground mr-1 text-[10px] font-semibold tracking-wide uppercase">
          Speed
        </span>
        {SPEEDS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSetSpeed(s.ms)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              speedMs === s.ms
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
