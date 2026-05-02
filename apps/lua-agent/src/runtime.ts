/**
 * Shared runtime singletons for the Lua agent.
 *
 * Every tool reaches into this module rather than constructing its own
 * RaschEngine / SessionStore / item bank — that way state survives across
 * tool invocations (in-memory; per-process).
 */
import {
  RaschEngine,
  type AssessmentReport,
  type Item,
} from '@maths-diag/core';
import { ITEMS } from './items.js';

// Items are inlined as a TS module (see ./items.ts) because Lua's sandbox
// runs the compiled bundle via vm.Script(eval) — no import.meta.url, no
// filesystem access to data/ outside the bundle.
export const ALL_ITEMS: readonly Item[] = ITEMS;

const ITEMS_BY_ID: Map<string, Item> = new Map(ITEMS.map((it) => [it.id, it]));

export const engine = new RaschEngine();

// Sessions live in `./session-storage.ts` because the Lua sandbox resets
// module state between chat turns — we need a durable backend in prod and
// an in-memory backend in tests.
export { sessions } from './session-storage.js';

const reportCache = new Map<string, AssessmentReport>();

export function getItemById(id: string): Item | null {
  return ITEMS_BY_ID.get(id) ?? null;
}

export function getCachedReport(sessionId: string): AssessmentReport | null {
  return reportCache.get(sessionId) ?? null;
}

export function setCachedReport(
  sessionId: string,
  report: AssessmentReport,
): void {
  reportCache.set(sessionId, report);
}
