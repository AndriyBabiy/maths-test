/**
 * Public surface for the diagnostic agent — used by the route handler.
 *
 * Each function invokes the matching graph with `configurable: { thread_id }`
 * so MemorySaver picks up the right per-session checkpoint. The session-store
 * Map is the source of truth for the SessionState we feed in; we read from it
 * before invoking and write back the checkpoint result afterwards.
 */
import type { AssessmentReport, Item } from '@maths-diag/core';
import { ITEMS } from '@maths-diag/core';
import { answerGraph, finaliseGraph, startGraph } from './graph';
import * as store from './session-store';
import { fromSessionState, toSessionState, type AgentStateUpdate } from './state';

const RUN_CONFIG = (sessionId: string) => ({
  configurable: { thread_id: sessionId },
});

/** Synchronise the canonical session-store with whatever the graph returned. */
function persistFromGraphState(sessionId: string, finalState: {
  sessionId: string;
  stageEstimate: ReturnType<typeof toSessionState>['stageEstimate'];
  theta: ReturnType<typeof toSessionState>['theta'];
  se: ReturnType<typeof toSessionState>['se'];
  history: ReturnType<typeof toSessionState>['history'];
  itemsAsked: ReturnType<typeof toSessionState>['itemsAsked'];
  finalised: ReturnType<typeof toSessionState>['finalised'];
}): void {
  store.set(sessionId, {
    sessionId,
    stageEstimate: finalState.stageEstimate,
    theta: finalState.theta,
    se: finalState.se,
    history: finalState.history,
    itemsAsked: finalState.itemsAsked,
    finalised: finalState.finalised,
  });
}

export interface StartResult {
  item: Item;
  asked: number;
  commentary: string;
}

export async function startAssessment(sessionId: string): Promise<StartResult> {
  // Reset the session — `start` always begins from a clean slate.
  const fresh = store.init(sessionId);
  const seed: AgentStateUpdate = fromSessionState(fresh);

  const result = await startGraph.invoke(seed, RUN_CONFIG(sessionId));
  if (!result.nextItem) {
    throw new Error('start: no item could be picked from the bank');
  }
  persistFromGraphState(sessionId, result);
  return {
    item: result.nextItem,
    asked: result.itemsAsked.size + 1, // include the just-picked item
    commentary: result.commentary,
  };
}

export type AnswerResult =
  | { kind: 'next_item'; item: Item; asked: number; commentary: string; lastCorrect: boolean }
  | { kind: 'report'; report: AssessmentReport; commentary: string; lastCorrect: boolean };

export interface AnswerArgs {
  sessionId: string;
  itemId: string;
  chosenIndex: 0 | 1 | 2 | 3;
  latencyMs: number;
}

export async function answerAssessment(args: AnswerArgs): Promise<AnswerResult> {
  const current = store.get(args.sessionId);
  if (!current) {
    throw new Error(`Unknown sessionId: ${args.sessionId}`);
  }

  const item = ITEMS.find((it) => it.id === args.itemId);
  if (!item) {
    throw new Error(`Unknown itemId: ${args.itemId}`);
  }
  const correct = item.correctIndex === args.chosenIndex;

  const seed: AgentStateUpdate = {
    ...fromSessionState(current),
    lastAnswer: {
      itemId: args.itemId,
      chosenIndex: args.chosenIndex,
      latencyMs: args.latencyMs,
      correct,
    },
    // Clear stale per-turn fields from the previous turn's checkpoint.
    nextItem: undefined,
    report: undefined,
    recommendation: undefined,
    commentary: '',
  };

  const result = await answerGraph.invoke(seed, RUN_CONFIG(args.sessionId));
  persistFromGraphState(args.sessionId, result);

  if (result.report) {
    return {
      kind: 'report',
      report: result.report,
      commentary: result.commentary,
      lastCorrect: correct,
    };
  }

  if (!result.nextItem) {
    // Bank exhausted but no report produced — finalise as a fallback.
    // The fallback drops the just-scored boolean (finaliseAssessment doesn't
    // know about it), so re-attach `correct` from this turn here.
    const finalised = await finaliseAssessment(args.sessionId);
    return { kind: 'report', ...finalised, lastCorrect: correct };
  }

  // The history contains the just-scored answer; itemsAsked already
  // contains the previously-asked item, but the new pick has not yet been
  // persisted to itemsAsked (pickItem doesn't add — engine.update does).
  // For UI display, "asked" should be the count INCLUDING the upcoming item.
  return {
    kind: 'next_item',
    item: result.nextItem,
    asked: result.itemsAsked.size + 1,
    commentary: result.commentary,
    lastCorrect: correct,
  };
}

export interface FinaliseResult {
  report: AssessmentReport;
  commentary: string;
}

export async function finaliseAssessment(
  sessionId: string,
): Promise<FinaliseResult> {
  const current = store.get(sessionId);
  if (!current) {
    throw new Error(`Unknown sessionId: ${sessionId}`);
  }
  const seed: AgentStateUpdate = fromSessionState(current);
  const result = await finaliseGraph.invoke(seed, RUN_CONFIG(sessionId));
  persistFromGraphState(sessionId, result);
  if (!result.report) {
    throw new Error('finalise: graph did not produce a report');
  }
  return { report: result.report, commentary: result.commentary };
}
