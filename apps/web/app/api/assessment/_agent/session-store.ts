/**
 * In-memory session store, keyed by sessionId.
 *
 * PRODUCTION TODO: replace with Postgres / Redis. This module-level Map
 * holds state in process memory; in dev that's fine because Next.js
 * keeps modules warm across HMR reloads, and a single Node process serves
 * every request. In production behind multiple instances it will lose
 * state across requests routed to different workers.
 */
import type { EducationLevel, SessionState, Stage, Strand } from '@maths-diag/core';

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

/**
 * Map a self-reported level to a session seed.
 *
 * `stageEstimate` is the pool filter applied by `RaschEngine.pickItem`; today
 * the item bank only carries `junior_cycle` items, so every level falls back
 * there to keep the pool non-empty. When primary / leaving_cert / university
 * content is authored, update STAGE_FOR_LEVEL to point at the matching stage —
 * the picker will pick it up automatically.
 *
 * `theta` is seeded to a per-level target so the first item lands in the
 * intended difficulty band immediately, before the Rasch update has any data
 * to work with. Values match the item bank's b ∈ [-2, +3] range.
 */
const STAGE_FOR_LEVEL: Record<EducationLevel, Stage> = {
  foundations: 'junior_cycle', // TODO: switch to 'primary' when primary items exist
  junior_cert: 'junior_cycle',
  leaving_cert: 'junior_cycle', // TODO: switch to 'leaving_cert' when LC items exist
  university: 'junior_cycle', // TODO: extend Stage with 'university' when content lands
};

const THETA_FOR_LEVEL: Record<EducationLevel, number> = {
  foundations: -1.5,
  junior_cert: 0,
  leaving_cert: 1.0,
  university: 2.0,
};

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

/**
 * Initialise (or reset) the session for sessionId.
 *
 * When `level` is supplied, seeds `stageEstimate` + `theta` from the
 * level→effect tables above. When omitted, returns the legacy cold-start
 * state and the stage-router probes the first 1-2 answers.
 */
export function init(sessionId: string, level?: EducationLevel): SessionState {
  const state = freshState(sessionId);
  if (level) {
    // Non-null assertion: `Record<EducationLevel, …>` indexed with a narrowed
    // `EducationLevel` is logically total, but apps/web has
    // `noUncheckedIndexedAccess: true` which widens the access to `T | undefined`.
    // Matches the assertion pattern used elsewhere in the agent (see nodes.ts).
    state.stageEstimate = STAGE_FOR_LEVEL[level]!;
    state.theta = seedStrandRecord(THETA_FOR_LEVEL[level]!);
  }
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
