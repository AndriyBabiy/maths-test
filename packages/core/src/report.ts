/**
 * Pure report builder.
 *
 * Stateless — given a `SessionState`, produces a deterministic
 * `AssessmentReport`. The LLM has no role here; natural-language
 * commentary lives outside.
 */
import type { AssessmentReport, SessionState, Stage, Strand, Tier } from './types';
import { RaschEngine } from './rasch-engine';
import { ITEMS } from './items';

/** Strands that appear in the report (excludes primary-only `measures_data`). */
const REPORT_STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
];

/** Ordinal mapping so we can sort tiers and pick the median. */
const TIER_ORDER: Record<Tier, number> = {
  foundation: 0,
  ordinary: 1,
  higher: 2,
};

const ITEMS_BY_ID: Map<string, (typeof ITEMS)[number]> = new Map(
  ITEMS.map((it) => [it.id, it]),
);

const engine = new RaschEngine();

/**
 * Produce a final AssessmentReport from session state.
 *  - per-strand tier via engine.tierFromTheta
 *  - overallTier = median tier across the 5 reported strands
 *  - confidence = clamp(1 - SE, 0, 1)
 *  - strengths/gaps from history filtered by current strand theta
 *  - nextSteps blurb mentions strongest + weakest strand
 */
export function buildReport(state: SessionState): AssessmentReport {
  const stage: Stage = state.stageEstimate ?? 'junior_cycle';

  const strands = {} as AssessmentReport['strands'];
  for (const strand of REPORT_STRANDS) {
    const theta = state.theta[strand];
    const se = state.se[strand];
    // SE starts at 1.0 and floors at 0.25 → confidence in [0, 0.75].
    const confidence = Math.max(0, Math.min(1, 1 - se));
    strands[strand] = {
      theta,
      tier: engine.tierFromTheta(theta),
      confidence,
    };
  }

  // Overall tier = median across 5 reported strands. With 5 ordered tiers the
  // middle index is unambiguous (e.g. [F,F,O,O,H] → O).
  const orderedTiers = REPORT_STRANDS.map((s) => strands[s].tier).sort(
    (a, b) => TIER_ORDER[a] - TIER_ORDER[b],
  );
  const overallTier: Tier = orderedTiers[Math.floor(orderedTiers.length / 2)]!;

  // Strengths / gaps. Use the per-strand theta at finalisation time, not the
  // running theta at answer time (simpler, good enough for a diagnostic).
  const strengths = new Set<string>();
  const gaps = new Set<string>();
  for (const turn of state.history) {
    const item = ITEMS_BY_ID.get(turn.itemId);
    if (!item) continue;
    const thetaNow = state.theta[item.strand];
    if (turn.correct && thetaNow > 1.0) {
      strengths.add(item.learningOutcome);
    } else if (!turn.correct && thetaNow < -0.5) {
      gaps.add(item.learningOutcome);
    }
  }

  // Strongest / weakest strand by theta drives the next-steps blurb.
  const ranked = [...REPORT_STRANDS].sort(
    (a, b) => state.theta[b] - state.theta[a],
  );
  const topStrand = ranked[0]!;
  const weakStrand = ranked[ranked.length - 1]!;
  const gapList = Array.from(gaps).slice(0, 3);
  const gapBlurb =
    gapList.length > 0
      ? ` Items to review: ${gapList.join('; ')}.`
      : ' No clear gaps detected at this confidence level.';
  const nextSteps =
    `Strongest in ${topStrand} (theta=${state.theta[topStrand].toFixed(2)}); ` +
    `focus next on ${weakStrand} (theta=${state.theta[weakStrand].toFixed(2)}).` +
    gapBlurb;

  return {
    stage,
    overallTier,
    strands,
    strengths: Array.from(strengths),
    gaps: Array.from(gaps),
    nextSteps,
  };
}
