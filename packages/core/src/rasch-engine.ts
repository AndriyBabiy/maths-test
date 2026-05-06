import type { Item, SessionState, Strand, Tier, Recommendation } from './types';

/**
 * K factor for the Rasch 1PL theta update.
 * Exported so tests can reference the same value the engine uses.
 */
export const K_FACTOR = 0.4;

/** Sigmoid / logistic. */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Strands that count toward the SE-based "finalise" rule per design doc. */
const ACTIVE_JC_STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
];

const ALL_STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
  'measures_data',
];

export class RaschEngine {
  /**
   * Rasch 1PL update.
   *   p(correct) = sigmoid(theta - b)
   *   theta_new  = theta_old + K * (observed - expected)
   *
   * SE uses a simple monotonic-shrinkage approximation:
   *   SE_new = max(0.25, 1 / sqrt(1 + n_strand))
   * Proper IRT SE is overkill for a hackathon; this gives the right
   * shape (decreasing with each item, floored) so the "stop when SE<0.4"
   * rule fires after roughly 6 items in the strand.
   *
   * To avoid plumbing an item registry through the engine, n_strand is
   * recovered from the prior SE by inverting the same formula:
   *   n = (1 / SE_old)^2 - 1
   * This is exact for n < 15; once SE hits the 0.25 floor n is capped at
   * 15, but by then the recommend() rule will have finalised the session.
   *
   * Returns a NEW SessionState — does not mutate the input.
   */
  update(
    state: SessionState,
    item: Item,
    correct: boolean,
    latencyMs: number = 0,
    chosenIndex?: 0 | 1 | 2 | 3,
  ): SessionState {
    const strand = item.strand;

    // Theta update.
    const thetaOld = state.theta[strand];
    const expected = sigmoid(thetaOld - item.b);
    const observed = correct ? 1 : 0;
    const thetaNew = thetaOld + K_FACTOR * (observed - expected);

    // SE update via inversion of prior SE.
    const seOld = state.se[strand];
    let prevN = 0;
    if (seOld < 1) {
      const inv = 1 / seOld;
      prevN = Math.max(0, Math.round(inv * inv - 1));
    }
    const nStrand = prevN + 1;
    const seNew = Math.max(0.25, 1 / Math.sqrt(1 + nStrand));

    const newTheta: Record<Strand, number> = { ...state.theta, [strand]: thetaNew };
    const newSe: Record<Strand, number> = { ...state.se, [strand]: seNew };
    const newHistory = [
      ...state.history,
      { itemId: item.id, correct, latencyMs, chosenIndex },
    ];
    const newItemsAsked = new Set(state.itemsAsked);
    newItemsAsked.add(item.id);

    return {
      ...state,
      theta: newTheta,
      se: newSe,
      history: newHistory,
      itemsAsked: newItemsAsked,
    };
  }

  /**
   * Pick from candidates the item whose `b` is closest to a streak-aware
   * target difficulty.
   *
   *   target_b = theta[strand] + streakBoost
   *
   * `streakBoost` is computed by the GLOBAL streak helper below — a hot or
   * cold run across mixed strands pushes the picker toward the edges of the
   * bank (LC HL up at b≈+3 or primary fundamentals down at b≈-3) far faster
   * than the K=0.4 Rasch update alone could reach. Without this, 4–6
   * items/strand only carries theta into JC OL territory and the learner
   * never sees fundamentals or LC items — the picker keeps sampling the
   * same b≈0 cluster every time it rotates back to a strand.
   *
   * Filters: strand match, stage match (when stageEstimate is set), and
   * exclude already-asked. Sparse-bank graceful fallback: return closest
   * candidate even if outside ±0.5 of the target.
   */
  pickItem(
    candidates: Item[],
    state: SessionState,
    strand: Strand,
    opts: { streakBoost?: number } = {},
  ): Item | null {
    const theta = state.theta[strand];
    const stage = state.stageEstimate;
    const streakBoost = opts.streakBoost ?? 0;
    const targetB = theta + streakBoost;

    const filtered = candidates.filter((c) => {
      if (c.strand !== strand) return false;
      if (stage !== null && c.stage !== stage) return false;
      if (state.itemsAsked.has(c.id)) return false;
      return true;
    });

    if (filtered.length === 0) return null;

    // Sort by |b - targetB| ascending, tie-break by lower b.
    const sorted = [...filtered].sort((a, b) => {
      const da = Math.abs(a.b - targetB);
      const db = Math.abs(b.b - targetB);
      if (da !== db) return da - db;
      return a.b - b.b;
    });

    return sorted[0] ?? null;
  }

  /**
   * Compute streak boost from the most recent answers across ALL strands.
   *
   * Per consecutive correct, add +0.5 to target b; per consecutive incorrect,
   * subtract 0.5. Capped at ±1.8 so we don't over-shoot the bank's b-range.
   * The streak resets when the result direction flips.
   *
   * Why global (not per-strand): the agent's strand picker rotates aggressively
   * (highest-SE wins after every answer), so consecutive answers within a
   * single strand basically never happen during normal flow. A per-strand
   * streak therefore stays stuck at length 0 or 1, the boost stays at 0, and
   * target_b never escapes the b≈0 cluster — the learner sees the same
   * difficulty band for the entire run. Using the global trailing run lets a
   * hot streak across mixed strands push subsequent picks (in any strand)
   * toward the harder end of the bank, which is what learners and reviewers
   * expect from "the difficulty progressively increases".
   *
   * `strand` and `items` are accepted for backward-compatible call-sites but
   * are not used — the boost is now strand-agnostic.
   *
   * Examples:
   *   3 correct in a row across (algebra, functions, number) → +1.5
   *   2 incorrect after any prior history                      → -1.0
   */
  streakBoost(
    history: SessionState['history'],
    _strand?: Strand,
    _items?: Item[],
  ): number {
    void _strand;
    void _items;
    if (history.length === 0) return 0;
    const STEP = 0.5;
    const CAP = 1.8;
    let streak = 0;
    let direction: 'correct' | 'incorrect' | null = null;

    for (let i = history.length - 1; i >= 0; i -= 1) {
      const entry = history[i];
      if (!entry) break;
      const result: 'correct' | 'incorrect' = entry.correct ? 'correct' : 'incorrect';
      if (direction === null) direction = result;
      else if (direction !== result) break;
      streak += 1;
    }

    if (streak === 0 || direction === null) return 0;
    const magnitude = Math.min(CAP, streak * STEP);
    return direction === 'correct' ? magnitude : -magnitude;
  }

  /**
   * SE-based recommendation after an answer:
   *   1. itemsAsked >= 20            → 'finalise' (hard cap)
   *   2. >=4 of 5 active JC strands have SE < 0.4 → 'finalise'
   *   3. SE[justUpdatedStrand] < 0.4 → 'switch_strand'
   *   4. otherwise                   → 'continue'
   *
   * Note: `measures_data` is primary-only; for JC/LC stages it is excluded
   * from the "active strands" count. The fixture is JC-only at this point.
   */
  recommend(state: SessionState, justUpdatedStrand: Strand): Recommendation {
    if (state.itemsAsked.size >= 20) return 'finalise';

    const activeStrands =
      state.stageEstimate === 'primary' ? ALL_STRANDS : ACTIVE_JC_STRANDS;
    const tightStrands = activeStrands.filter((s) => state.se[s] < 0.4);
    if (tightStrands.length >= 4) return 'finalise';

    if (state.se[justUpdatedStrand] < 0.4) return 'switch_strand';

    return 'continue';
  }

  /**
   * Map a final theta to a tier per design doc:
   *   theta < -0.5      → foundation
   *   -0.5 <= θ <= 1.0  → ordinary
   *   theta > 1.0       → higher
   */
  tierFromTheta(theta: number): Tier {
    if (theta < -0.5) return 'foundation';
    if (theta > 1.0) return 'higher';
    return 'ordinary';
  }
}
