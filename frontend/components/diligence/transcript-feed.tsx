'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { Turn } from '@/lib/demo/types';
import { cn } from '@/lib/shadcn/utils';

interface TranscriptFeedProps {
  transcript: Turn[];
}

export function TranscriptFeed({ transcript }: TranscriptFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Call hasn&apos;t started. Press play.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transcript.map((turn) => {
        const isAnalyst = turn.speaker === 'analyst';
        const prompted =
          typeof turn.prompted_by_copilot !== 'undefined' && turn.prompted_by_copilot;
        return (
          <motion.div
            key={turn.t}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex flex-col', isAnalyst ? 'items-end' : 'items-start')}
          >
            <div className="mb-1 flex items-center gap-2 px-1">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                {isAnalyst ? 'You (buy-side)' : 'Researcher'}
              </span>
              {prompted && (
                <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                  Copilot-prompted
                </span>
              )}
            </div>
            <div
              className={cn(
                'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-snug',
                isAnalyst
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              )}
            >
              {turn.text}
            </div>
          </motion.div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
