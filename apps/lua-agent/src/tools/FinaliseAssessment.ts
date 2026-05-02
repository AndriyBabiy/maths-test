import type { LuaTool } from 'lua-cli';
import { z } from 'zod';
import type {
  AssessmentReport,
  Stage,
  Strand,
  Tier,
} from '@maths-diag/core';
import {
  engine,
  getCachedReport,
  getItemById,
  sessions,
  setCachedReport,
} from '../runtime.js';

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

export class FinaliseAssessment implements LuaTool {
  name = 'finalise_assessment';
  description =
    'Produce the final AssessmentReport: stage, overall tier, per-strand tier + ' +
    'confidence, strengths, gaps, and a natural-language next-steps summary. ' +
    'Call when SE < 0.4 on >= 4 strands OR 15 items have been asked.';
  inputSchema = z.object({ sessionId: z.string() });

  async execute(input: { sessionId: string }): Promise<unknown> {
    const { sessionId } = input;

    const state = await sessions.get(sessionId);
    if (!state) {
      throw new Error(`[finalise_assessment] Unknown session: ${sessionId}`);
    }

    // If already finalised, serve the cached report. We deliberately keep the
    // cache OUT of SessionState to avoid touching shared types.
    //
    // Note: in the Lua sandbox the in-memory `reportCache` Map is reset
    // between turns, so a cache miss is expected on a "view past report"
    // call from a later turn. The fallback below rebuilds deterministically
    // from the persisted SessionState.
    if (state.finalised) {
      const cached = getCachedReport(sessionId);
      if (cached) return cached;
    }

    const stage: Stage = state.stageEstimate ?? 'junior_cycle';

    // Per-strand tier + confidence.
    const strands = {} as AssessmentReport['strands'];
    for (const strand of REPORT_STRANDS) {
      const theta = state.theta[strand];
      const se = state.se[strand];
      // Confidence ~ 1 - SE, clamped. SE starts at 1.0 and can fall to 0.25
      // floor; that maps to confidence in [0, 0.75].
      const confidence = Math.max(0, Math.min(1, 1 - se));
      strands[strand] = {
        theta,
        tier: engine.tierFromTheta(theta),
        confidence,
      };
    }

    // Overall tier = median across the 5 reported strands.
    // Sort by ordinal (F=0, O=1, H=2) and take the middle entry. With 5
    // strands the median is unambiguous; for ties on either side of the
    // median the sort still yields a stable middle pick (e.g.
    // [F, F, O, O, H] -> O). Documented choice.
    const orderedTiers = REPORT_STRANDS.map((s) => strands[s].tier).sort(
      (a, b) => TIER_ORDER[a] - TIER_ORDER[b],
    );
    const overallTier: Tier = orderedTiers[Math.floor(orderedTiers.length / 2)]!;

    // Build strengths / gaps from the answer history. Look up each answered
    // item to surface its `learningOutcome`. We use the per-strand theta at
    // *finalisation* time, not the running theta at answer time — simpler
    // and good enough for the demo.
    const strengths = new Set<string>();
    const gaps = new Set<string>();
    for (const turn of state.history) {
      const item = getItemById(turn.itemId);
      if (!item) continue;
      const thetaNow = state.theta[item.strand];
      if (turn.correct && thetaNow > 1.0) {
        strengths.add(item.learningOutcome);
      } else if (!turn.correct && thetaNow < -0.5) {
        gaps.add(item.learningOutcome);
      }
    }

    // Pick the strongest / weakest strand by theta for the templated
    // next-steps blurb. Deterministic — no LLM here; the agent's natural-
    // language commentary happens *outside* this tool.
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

    const report: AssessmentReport = {
      stage,
      overallTier,
      strands,
      strengths: Array.from(strengths),
      gaps: Array.from(gaps),
      nextSteps,
    };

    await sessions.update(sessionId, (s) => ({ ...s, finalised: true }));
    setCachedReport(sessionId, report);

    return report;
  }
}
