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
      { itemId: item.id, correct, latencyMs },
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
   * Pick from candidates the item whose `b` is closest to theta[strand].
   *  - Filter by strand, stage (if known), and exclude already-asked.
   *  - If closest |b - theta| > 0.5, return null (caller decides next step).
   *  - Tie-break: prefer the lower `b` (less risk of frustrating learner).
   */
  pickItem(candidates: Item[], state: SessionState, strand: Strand): Item | null {
    const theta = state.theta[strand];
    const stage = state.stageEstimate;

    const filtered = candidates.filter((c) => {
      if (c.strand !== strand) return false;
      if (stage !== null && c.stage !== stage) return false;
      if (state.itemsAsked.has(c.id)) return false;
      return true;
    });

    if (filtered.length === 0) return null;

    // Sort by |b - theta| ascending, tie-break by lower b.
    const sorted = [...filtered].sort((a, b) => {
      const da = Math.abs(a.b - theta);
      const db = Math.abs(b.b - theta);
      if (da !== db) return da - db;
      return a.b - b.b;
    });

    const best = sorted[0]!;
    if (Math.abs(best.b - theta) > 0.5) return null;
    return best;
  }

  /**
   * SE-based recommendation after an answer:
   *   1. itemsAsked >= 15            → 'finalise' (hard cap)
   *   2. >=4 of 5 active JC strands have SE < 0.4 → 'finalise'
   *   3. SE[justUpdatedStrand] < 0.4 → 'switch_strand'
   *   4. otherwise                   → 'continue'
   *
   * Note: `measures_data` is primary-only; for JC/LC stages it is excluded
   * from the "active strands" count. The fixture is JC-only at this point.
   */
  recommend(state: SessionState, justUpdatedStrand: Strand): Recommendation {
    if (state.itemsAsked.size >= 15) return 'finalise';

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
