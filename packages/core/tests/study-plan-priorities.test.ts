import { describe, it, expect } from 'vitest';
import {
  computeStrandPriorities,
  weeksUntil,
} from '../src/study-plan-priorities';
import type { AssessmentReport } from '../src/types';
import type { StudyPlanInput } from '../src/study-plan-types';

function makeReport(perStrandTier: 'foundation' | 'ordinary' | 'higher'): AssessmentReport {
  const strandIds: AssessmentReport['strands'] extends Record<infer K, unknown>
    ? K
    : never = 'number';
  void strandIds;
  return {
    stage: 'junior_cycle',
    overallTier: perStrandTier,
    strands: {
      number: { theta: 0, tier: perStrandTier, confidence: 0.7 },
      algebra: { theta: 0, tier: perStrandTier, confidence: 0.7 },
      geometry_trig: { theta: 0, tier: perStrandTier, confidence: 0.7 },
      functions: { theta: 0, tier: perStrandTier, confidence: 0.7 },
      statistics_prob: { theta: 0, tier: perStrandTier, confidence: 0.7 },
      measures_data: { theta: 0, tier: perStrandTier, confidence: 0.7 },
    },
    strengths: [],
    gaps: [],
    nextSteps: '',
  };
}

const baseInput: StudyPlanInput = {
  goalTier: 'higher',
  targetDate: '2026-12-31',
  weeklyHours: 6,
  focusStrands: [],
};

describe('computeStrandPriorities', () => {
  it('all gaps=2 when current=foundation and goal=higher', () => {
    const ps = computeStrandPriorities(makeReport('foundation'), baseInput);
    expect(ps).toHaveLength(5);
    expect(ps.every((p) => p.gap === 2)).toBe(true);
  });

  it('clamps negative gaps to 0 when learner already exceeds goal', () => {
    const ps = computeStrandPriorities(makeReport('higher'), {
      ...baseInput,
      goalTier: 'foundation',
    });
    expect(ps.every((p) => p.gap === 0)).toBe(true);
  });

  it('focusStrands break ties when gap is equal', () => {
    const ps = computeStrandPriorities(makeReport('ordinary'), {
      ...baseInput,
      goalTier: 'higher',
      focusStrands: ['statistics_prob'],
    });
    // All gaps = 1, focusStrand should sort first.
    expect(ps[0]!.strand).toBe('statistics_prob');
  });

  it('alphabetical tie-break for equal gap and no focus', () => {
    const ps = computeStrandPriorities(makeReport('ordinary'), {
      ...baseInput,
      goalTier: 'higher',
    });
    // Alphabetical among 5 active strands: algebra, functions, geometry_trig, number, statistics_prob
    expect(ps.map((p) => p.strand)).toEqual([
      'algebra',
      'functions',
      'geometry_trig',
      'number',
      'statistics_prob',
    ]);
  });
});

describe('weeksUntil', () => {
  it('returns at least 1 week even when target is today', () => {
    const today = '2026-05-03';
    expect(weeksUntil(today, today)).toBe(1);
  });

  it('rounds up partial weeks', () => {
    expect(weeksUntil('2026-05-17', '2026-05-03')).toBe(2);
    expect(weeksUntil('2026-05-18', '2026-05-03')).toBe(3);
  });

  it('handles year-spanning ranges', () => {
    // 52 weeks + 1 day → 53
    expect(weeksUntil('2027-05-04', '2026-05-03')).toBe(53);
  });
});
