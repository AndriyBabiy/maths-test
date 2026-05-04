/**
 * In-memory session store, keyed by sessionId.
 *
 * PRODUCTION TODO: replace with Postgres / Redis. This module-level Map
 * holds state in process memory; in dev that's fine because Next.js
 * keeps modules warm across HMR reloads, and a single Node process serves
 * every request. In production behind multiple instances it will lose
 * state across requests routed to different workers.
 */
import type { SessionState, Strand } from '@maths-diag/core';

const ALL_STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
  'measures_data',
];

function seedStrandRecord(value: number): Record<Strand, number> {
  const out = {} as Record<Strand, number>;
  for (const s of ALL_STRANDS) {
    out[s] = value;
  }
  return out;
}

// Module-level singleton. Survives across requests within a single process.
const sessions = new Map<string, SessionState>();

function freshState(sessionId: string): SessionState {
  return {
    sessionId,
    stageEstimate: null,
    theta: seedStrandRecord(0),
    se: seedStrandRecord(1.0),
    history: [],
    itemsAsked: new Set<string>(),
    finalised: false,
  };
}

/** Initialise (or reset) the session for sessionId. */
export function init(sessionId: string): SessionState {
  const state = freshState(sessionId);
  sessions.set(sessionId, state);
  return state;
}

export function get(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

export function set(sessionId: string, state: SessionState): void {
  sessions.set(sessionId, state);
}

/** Get-or-init: convenience helper for graphs that may run before `init`. */
export function getOrInit(sessionId: string): SessionState {
  const existing = sessions.get(sessionId);
  if (existing) return existing;
  return init(sessionId);
}
