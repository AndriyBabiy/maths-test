import type { Stage } from './types';

/**
 * Stage detection from the first 1-2 probe answers.
 *
 *   q1 (Number, b=-1) wrong               → primary       (conf 0.8)
 *   q1 right, q2 not asked yet            → junior_cycle  (conf 0.5, provisional)
 *   q1 right + q2 (Algebra, b=+1) right   → leaving_cert  (conf 0.8)
 *   q1 right + q2 wrong                   → junior_cycle  (conf 0.7)
 */
export function detectStageFromProbes(
  q1Correct: boolean,
  q2Correct: boolean | null,
): { stage: Stage; confidence: number } {
  if (q1Correct === false) {
    return { stage: 'primary', confidence: 0.8 };
  }
  if (q2Correct === null) {
    return { stage: 'junior_cycle', confidence: 0.5 };
  }
  if (q2Correct === true) {
    return { stage: 'leaving_cert', confidence: 0.8 };
  }
  return { stage: 'junior_cycle', confidence: 0.7 };
}
