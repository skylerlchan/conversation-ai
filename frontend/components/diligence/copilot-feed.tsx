'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { CopilotEvent, CopilotEventType } from '@/hooks/useDiligenceDemo';
import { cn } from '@/lib/shadcn/utils';

const TYPE_META: Record<CopilotEventType, { label: string; badge: string; bar: string }> = {
  grounding: {
    label: 'Grounded',
    badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    bar: 'bg-sky-500',
  },
  followup: {
    label: 'Follow-up',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  flag: {
    label: 'Inconsistency',
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400',
    bar: 'bg-red-500',
  },
  thesis: {
    label: 'Thesis delta',
    badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    bar: 'bg-violet-500',
  },
  nudge: {
    label: 'Nudge',
    badge: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    bar: 'bg-zinc-500',
  },
};

interface CopilotFeedProps {
  events: CopilotEvent[];
}

export function CopilotFeed({ events }: CopilotFeedProps) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        The copilot logs every lookup, follow-up, and flag here as the researcher talks.
      </p>
    );
  }

  // Newest first so the latest action is always visible.
  const ordered = [...events].reverse();

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {ordered.map((ev) => {
          const meta = TYPE_META[ev.type];
          return (
            <motion.div
              key={ev.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card relative overflow-hidden rounded-lg border pl-3 shadow-sm"
            >
              <span className={cn('absolute inset-y-0 left-0 w-1', meta.bar)} aria-hidden />
              <div className="p-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                      meta.badge
                    )}
                  >
                    {meta.label}
                  </span>
                  {ev.questionId && (
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wide">
                      {ev.questionId}
                    </span>
                  )}
                </div>
                {ev.text && <p className="mt-1 text-xs leading-snug">{ev.text}</p>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
