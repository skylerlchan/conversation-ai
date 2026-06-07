'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import type { ThesisDelta, ThesisDeltaCard } from '@/lib/demo/types';

interface ThesisDeltaPanelProps {
  cards: ThesisDeltaCard[];
  /** The full reconciled delta, shown once the call is done. */
  finalDelta?: ThesisDelta;
  done: boolean;
}

export function ThesisDeltaPanel({ cards, finalDelta, done }: ThesisDeltaPanelProps) {
  if (cards.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        When an answer moves a modeled assumption, the change lands here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {done && finalDelta ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            {finalDelta.changes.map((c) => (
              <motion.div
                key={c.field}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card rounded-md border p-2.5 text-xs"
              >
                <p className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
                  {c.field}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground line-through">{c.from}</span>
                  <ArrowRightIcon className="text-muted-foreground size-3 shrink-0" weight="bold" />
                  <span className="text-foreground font-semibold">{c.to}</span>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="rounded-md border border-violet-500/30 bg-violet-500/10 p-2.5">
            <p className="text-[10px] font-bold tracking-wide text-violet-600 uppercase dark:text-violet-400">
              Net
            </p>
            <p className="mt-1 text-xs leading-snug">{finalDelta.net}</p>
          </div>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {cards.map((card) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-md border border-violet-500/30 bg-violet-500/5 p-2.5"
            >
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wide">
                {card.questionId}
              </p>
              <p className="mt-1 text-xs leading-snug">{card.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
