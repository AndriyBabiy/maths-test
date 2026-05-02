import type { SessionState, Strand } from './types';

const ALL_STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
  'measures_data',
];

/**
 * Build a fresh `Record<Strand, number>` seeded with `value` for every strand.
 * Keeps runtime safe against missing strand keys.
 */
function seedStrandRecord(value: number): Record<Strand, number> {
  const out = {} as Record<Strand, number>;
  for (const s of ALL_STRANDS) {
    out[s] = value;
  }
  return out;
}

/**
 * In-memory session store. Trusts the caller to pass a pure updater (one that
 * returns a new state object); the store itself does not enforce immutability.
 */
export class SessionStore {
  private sessions = new Map<string, SessionState>();

  create(sessionId: string): SessionState {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session already exists: ${sessionId}`);
    }
    const state: SessionState = {
      sessionId,
      stageEstimate: null,
      theta: seedStrandRecord(0),
      se: seedStrandRecord(1.0),
      history: [],
      itemsAsked: new Set<string>(),
      finalised: false,
    };
    this.sessions.set(sessionId, state);
    return state;
  }

  get(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Caller passes a pure updater that returns a new state. We do not deep-copy
   * here — the engine returns fresh objects. If a caller mutates in place it
   * will leak through; that's a documented trust boundary.
   */
  update(
    sessionId: string,
    updater: (s: SessionState) => SessionState,
  ): SessionState {
    const current = this.sessions.get(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const next = updater(current);
    this.sessions.set(sessionId, next);
    return next;
  }
}
