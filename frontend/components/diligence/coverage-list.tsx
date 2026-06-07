'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { CoverageState, FlagCard, FollowupCard, Question } from '@/lib/demo/types';
import { cn } from '@/lib/shadcn/utils';

const STATE_META: Record<
  CoverageState,
  { label: string; dot: string; ring: string; text: string }
> = {
  answered: {
    label: 'Answered',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  partial: {
    label: 'Thin',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/40',
    text: 'text-amber-600 dark:text-amber-400',
  },
  unanswered: {
    label: 'Open',
    dot: 'bg-zinc-400 dark:bg-zinc-600',
    ring: 'ring-transparent',
    text: 'text-muted-foreground',
  },
};

interface CoverageListProps {
  questions: Question[];
  coverage: Record<string, CoverageState>;
  activeFollowups: FollowupCard[];
  flags: FlagCard[];
}

export function CoverageList({ questions, coverage, activeFollowups, flags }: CoverageListProps) {
  const followupByQid = new Map(activeFollowups.map((f) => [f.questionId, f]));
  const flagByQid = new Map(flags.map((f) => [f.questionId, f]));

  return (
    <ol className="space-y-2">
      {questions.map((q) => {
        const state = coverage[q.id] ?? 'unanswered';
        const meta = STATE_META[state];
        const followup = followupByQid.get(q.id);
        const flag = flagByQid.get(q.id);

        return (
          <li
            key={q.id}
            className={cn(
              'bg-card rounded-lg border p-3 shadow-sm transition-colors',
              state === 'answered' && 'border-emerald-500/30',
              state === 'partial' && 'border-amber-500/40',
              state === 'unanswered' && 'border-border'
            )}
          >
            <div className="flex items-start gap-3">
              <motion.span
                key={`${q.id}-${state}`}
                initial={{ scale: 0.6, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4', meta.dot, meta.ring)}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide">
                    {q.id}
                  </span>
                  <span
                    className={cn('text-[10px] font-semibold tracking-wide uppercase', meta.text)}
                  >
                    {meta.label}
                  </span>
                  {flag && (
                    <span className="rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-red-600 uppercase dark:text-red-400">
                      Inconsistency
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm leading-snug">{q.text}</p>
              </div>
            </div>

            <AnimatePresence>
              {followup && (
                <motion.div
                  key={followup.id}
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
                    <p className="text-[10px] font-bold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                      Ask next
                    </p>
                    <p className="mt-1 text-sm leading-snug text-amber-900 dark:text-amber-100">
                      {followup.text}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {flag && (
                <motion.div
                  key={flag.id}
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2.5">
                    <p className="text-[10px] font-bold tracking-wide text-red-600 uppercase dark:text-red-400">
                      Contradicts the {flag.vs}
                    </p>
                    <p className="mt-1 text-sm leading-snug text-red-900 dark:text-red-100">
                      {flag.detail}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
  );
}
