/**
 * Cross-turn session persistence.
 *
 * The Lua sandbox re-evaluates the agent bundle on every chat turn, so any
 * module-level Map/SessionStore is reset between turns. This module abstracts
 * over two backends:
 *
 *   - `MemorySessionStorage` wraps the in-package SessionStore. Used in
 *     tests and any non-sandbox runtime where lua-cli's Data API is not
 *     wired up.
 *   - `LuaDataSessionStorage` persists state in the Lua platform's custom
 *     data collection ("maths_sessions"), which survives across turns.
 *
 * Backend selection is done once at module load time based on `VITEST`.
 * The interface is async on both sides — tests pay a microtask hop, prod
 * pays a network round-trip.
 */
import { User } from 'lua-cli';
import { SessionStore, type SessionState, type Strand } from '@maths-diag/core';

export interface SessionStorage {
  get(sessionId: string): Promise<SessionState | null>;
  create(sessionId: string): Promise<SessionState>;
  update(
    sessionId: string,
    updater: (s: SessionState) => SessionState,
  ): Promise<SessionState>;
}

/**
 * Field on the User record where the active diagnostic session is stored.
 * One session per user is intentional: a learner shouldn't have two
 * adaptive assessments running concurrently.
 */
const USER_FIELD = 'mathsDiagnosticSession';

// itemsAsked is a Set, which JSON.stringify renders as `{}`. We round-trip
// through arrays at the storage boundary.
interface SerialisedSession {
  sessionId: string;
  stageEstimate: SessionState['stageEstimate'];
  theta: Record<Strand, number>;
  se: Record<Strand, number>;
  history: SessionState['history'];
  itemsAsked: string[];
  finalised: boolean;
}

function toSerialisable(state: SessionState): SerialisedSession {
  return {
    sessionId: state.sessionId,
    stageEstimate: state.stageEstimate,
    theta: state.theta,
    se: state.se,
    history: state.history,
    itemsAsked: Array.from(state.itemsAsked),
    finalised: state.finalised,
  };
}

function fromSerialisable(raw: SerialisedSession): SessionState {
  return {
    sessionId: raw.sessionId,
    stageEstimate: raw.stageEstimate,
    theta: raw.theta,
    se: raw.se,
    history: raw.history ?? [],
    itemsAsked: new Set(raw.itemsAsked ?? []),
    finalised: raw.finalised,
  };
}

class MemorySessionStorage implements SessionStorage {
  private readonly store = new SessionStore();

  async get(sessionId: string): Promise<SessionState | null> {
    return this.store.get(sessionId);
  }

  async create(sessionId: string): Promise<SessionState> {
    return this.store.create(sessionId);
  }

  async update(
    sessionId: string,
    updater: (s: SessionState) => SessionState,
  ): Promise<SessionState> {
    return this.store.update(sessionId, updater);
  }
}

class LuaUserSessionStorage implements SessionStorage {
  /**
   * Lua's User API auto-scopes to the conversation's user, so we don't need
   * to (and can't) key by sessionId at the storage layer. We DO honour the
   * caller's sessionId at the API surface — `get(otherId)` returns null when
   * the persisted session belongs to a different sessionId, which makes
   * `create(otherId)` semantically a "start a new diagnostic" without
   * tripping the "already exists" guard.
   *
   * This also avoids the read-after-write index lag we hit with Custom Data:
   * `User.update()` is read-your-writes consistent for the same conversation.
   */

  private async loadStored(): Promise<SessionState | null> {
    const user = await User.get();
    if (!user) return null;
    const raw = (user as { data?: Record<string, unknown> }).data?.[USER_FIELD]
      ?? (user as Record<string, unknown>)[USER_FIELD];
    if (!raw || typeof raw !== 'object' || !('sessionId' in raw)) return null;
    return fromSerialisable(raw as SerialisedSession);
  }

  private async writeStored(state: SessionState): Promise<void> {
    const user = await User.get();
    if (!user) {
      throw new Error('No user context for session storage');
    }
    await user.update({ [USER_FIELD]: toSerialisable(state) });
  }

  async get(sessionId: string): Promise<SessionState | null> {
    const stored = await this.loadStored();
    if (!stored) return null;
    // sessionId mismatch ≡ "the agent is asking about a different
    // assessment than the one persisted". Treat as not-found so the caller
    // re-creates rather than reading stale state.
    if (stored.sessionId !== sessionId) return null;
    return stored;
  }

  async create(sessionId: string): Promise<SessionState> {
    const stored = await this.loadStored();
    if (stored && stored.sessionId === sessionId) {
      throw new Error(`Session already exists: ${sessionId}`);
    }
    // Reuse SessionStore's seeding so the initial-state shape lives in one
    // place. Note: this overwrites any prior session for this user — the
    // caller's get() returning null implied "start fresh".
    const seedStore = new SessionStore();
    const seed = seedStore.create(sessionId);
    await this.writeStored(seed);
    return seed;
  }

  async update(
    sessionId: string,
    updater: (s: SessionState) => SessionState,
  ): Promise<SessionState> {
    const stored = await this.loadStored();
    if (!stored || stored.sessionId !== sessionId) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const next = updater(stored);
    await this.writeStored(next);
    return next;
  }
}

/** True when running under vitest — picks the in-memory backend. */
const useMemoryBackend = Boolean(process.env.VITEST);

export const sessions: SessionStorage = useMemoryBackend
  ? new MemorySessionStorage()
  : new LuaUserSessionStorage();
