// Typed loaders for the CAVA demo fixtures.
//
// The JSON files here are copies of `agent-py/demo/*.json` (the source of
// truth). Kept in-repo so the frontend demo runs with no backend, no Moss,
// and no LiveKit. The live agent will emit the same shapes as data packets.
import callJson from './cava-call.json';
import questionsJson from './cava-questions.json';
import type { CallFixture, QuestionsFixture } from './types';

export const questionsFixture = questionsJson as unknown as QuestionsFixture;
export const callFixture = callJson as unknown as CallFixture;

export * from './types';
