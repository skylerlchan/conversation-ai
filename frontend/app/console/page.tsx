import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ConsoleClient } from '@/components/console/console-client';

export const metadata: Metadata = {
  title: 'Diligence Copilot — Console',
  description:
    'Live diligence-call console: coverage tracking, grounded follow-ups, and inconsistency flags in real time.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="h-svh bg-[#0a0b0f]" />}>
      <ConsoleClient />
    </Suspense>
  );
}
