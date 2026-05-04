/**
 * Deterministic strand-priority computation for the study plan.
 *
 * Pure function: given an AssessmentReport + StudyPlanInput, returns an
 * ordered list of StrandPriority records. The LLM never re-derives this —
 * it only fills in the per-week schedule on top of these priorities.
 *
 * Why pure: gap analysis is mechanical, and we want the same input to
 * yield the same priority order every time so PDFs are reproducible.
 */
import type { AssessmentReport, Strand, Tier } from './types';
import type { StrandPriority, StudyPlanInput } from './study-plan-types';

const TIER_ORDER: Record<Tier, number> = {
  foundation: 0,
  ordinary: 1,
  higher: 2,
};

const REPORT_STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
];

const STRAND_LABEL: Record<Strand, string> = {
  number: 'Number',
  algebra: 'Algebra',
  geometry_trig: 'Geometry & Trigonometry',
  functions: 'Functions',
  statistics_prob: 'Statistics & Probability',
  measures_data: 'Measures & Data',
};

/**
 * Compute per-strand priorities. Sort order:
 *   1. Highest gap first (2 → 1 → 0)
 *   2. Tie-break by user-selected focusStrands (focused first)
 *   3. Tie-break by alphabetical strand name (deterministic)
 */
export function computeStrandPriorities(
  report: AssessmentReport,
  input: StudyPlanInput,
): StrandPriority[] {
  const focusSet = new Set(input.focusStrands);
  const priorities: StrandPriority[] = REPORT_STRANDS.map((strand) => {
    const current = report.strands[strand]?.tier ?? 'foundation';
    const goal = input.goalTier;
    const rawGap = TIER_ORDER[goal] - TIER_ORDER[current];
    // Negative gap means user is already above the goal — clamp to 0.
    const gap = Math.max(0, Math.min(2, rawGap)) as 0 | 1 | 2;
    return {
      strand,
      currentTier: current,
      goalTier: goal,
      gap,
      focus: buildFocusBlurb(strand, current, goal, gap, focusSet.has(strand)),
    };
  });

  return priorities.sort((a, b) => {
    if (a.gap !== b.gap) return b.gap - a.gap;
    const aFocused = focusSet.has(a.strand);
    const bFocused = focusSet.has(b.strand);
    if (aFocused !== bFocused) return aFocused ? -1 : 1;
    return a.strand.localeCompare(b.strand);
  });
}

function buildFocusBlurb(
  strand: Strand,
  current: Tier,
  goal: Tier,
  gap: 0 | 1 | 2,
  isUserFocus: boolean,
): string {
  const label = STRAND_LABEL[strand];
  if (gap === 0) {
    return `${label}: maintain ${current} performance with weekly mixed practice.`;
  }
  if (gap === 1) {
    return `${label}: bridge ${current} → ${goal} via targeted exam-style work.`;
  }
  if (gap === 2) {
    return `${label}: largest gap — needs foundational rebuild before stretch problems.`;
  }
  return isUserFocus
    ? `${label}: user-selected priority — extra weekly minutes.`
    : label;
}

/** Total weeks between today and targetDate, floored at 1. */
export function weeksUntil(targetIso: string, todayIso?: string): number {
  const today = todayIso ? new Date(todayIso) : new Date();
  const target = new Date(targetIso);
  const ms = target.getTime() - today.getTime();
  const weeks = Math.ceil(ms / (1000 * 60 * 60 * 24 * 7));
  return Math.max(1, weeks);
}

/** Convenience: localized strand label for headings. */
export function strandLabel(s: Strand): string {
  return STRAND_LABEL[s];
}
