import { describe, expect, it } from 'vitest';
import { detectStageFromProbes } from '../src/stage-router';

describe('detectStageFromProbes', () => {
  it('q1 wrong → primary (regardless of q2)', () => {
    expect(detectStageFromProbes(false, null)).toEqual({ stage: 'primary', confidence: 0.8 });
    expect(detectStageFromProbes(false, true)).toEqual({ stage: 'primary', confidence: 0.8 });
    expect(detectStageFromProbes(false, false)).toEqual({ stage: 'primary', confidence: 0.8 });
  });

  it('q1 right + q2 not asked → junior_cycle (provisional 0.5)', () => {
    expect(detectStageFromProbes(true, null)).toEqual({ stage: 'junior_cycle', confidence: 0.5 });
  });

  it('q1 right + q2 right → leaving_cert (0.8)', () => {
    expect(detectStageFromProbes(true, true)).toEqual({ stage: 'leaving_cert', confidence: 0.8 });
  });

  it('q1 right + q2 wrong → junior_cycle (0.7)', () => {
    expect(detectStageFromProbes(true, false)).toEqual({ stage: 'junior_cycle', confidence: 0.7 });
  });
});
