/**
 * Smoke test — walks the full diagnostic loop without an LLM.
 *
 * Calls each tool's `execute` directly to prove wiring is correct end-to-end:
 *   GetSessionState -> DetectStage -> (PickNextItem -> ScoreAnswer)* -> FinaliseAssessment
 */
import { describe, expect, it } from 'vitest';
import type { Strand } from '@maths-diag/core';
import { GetSessionState } from '../src/tools/GetSessionState.js';
import { DetectStage } from '../src/tools/DetectStage.js';
import { PickNextItem } from '../src/tools/PickNextItem.js';
import { ScoreAnswer } from '../src/tools/ScoreAnswer.js';
import { FinaliseAssessment } from '../src/tools/FinaliseAssessment.js';

interface SessionStateSnapshot {
  sessionId: string;
  stageEstimate: string | null;
  theta: Record<Strand, number>;
  se: Record<Strand, number>;
  itemsAsked: string[];
  historyCount: number;
  finalised: boolean;
}

interface PickResult {
  item: {
    id: string;
    strand: Strand;
    b: number;
    correctIndex: 0 | 1 | 2 | 3;
  } | null;
  hint?: string;
}

interface ScoreResult {
  correct: boolean;
  newTheta: number;
  newSE: number;
  recommendation: 'continue' | 'switch_strand' | 'finalise';
}

function strandWithHighestSE(se: Record<Strand, number>): Strand {
  // Mirror the agent's "least known" heuristic. Restrict to the 5 reported
  // strands so we don't pick measures_data (no items in the JC fixture).
  const candidates: Strand[] = [
    'number',
    'algebra',
    'geometry_trig',
    'functions',
    'statistics_prob',
  ];
  return candidates.reduce((best, s) => (se[s] > se[best] ? s : best));
}

describe('lua-agent smoke loop', () => {
  it('runs the full GetState -> DetectStage -> Pick/Score* -> Finalise loop', async () => {
    const sessionId = 'smoke-1';
    const getSessionState = new GetSessionState();
    const detectStage = new DetectStage();
    const pickNextItem = new PickNextItem();
    const scoreAnswer = new ScoreAnswer();
    const finaliseAssessment = new FinaliseAssessment();

    // 1. Initial state — should auto-create the session.
    const initial = (await getSessionState.execute({
      sessionId,
    })) as SessionStateSnapshot;
    expect(initial.sessionId).toBe(sessionId);
    expect(initial.itemsAsked).toEqual([]);
    expect(initial.historyCount).toBe(0);
    expect(initial.finalised).toBe(false);

    // 2. Stage detection: q1 right, q2 wrong → junior_cycle.
    // (Fixture is JC-only, so we deliberately route into JC stage.)
    const stageRes = (await detectStage.execute({
      sessionId,
      q1Correct: true,
      q2Correct: false,
    })) as { stage: string; confidence: number };
    expect(stageRes.stage).toBe('junior_cycle');
    expect(stageRes.confidence).toBeGreaterThan(0);

    // 3. Pick + score loop — simulate a "moderately strong" learner.
    let toolsExercised = new Set<string>([
      'get_session_state',
      'detect_stage',
    ]);
    let finaliseRecommended = false;
    let sparseStrands = 0;

    for (let i = 0; i < 20; i++) {
      const state = (await getSessionState.execute({
        sessionId,
      })) as SessionStateSnapshot;
      if (state.finalised) break;

      const strand = strandWithHighestSE(state.se);
      let pick: PickResult;
      try {
        pick = (await pickNextItem.execute({
          sessionId,
          strand,
        })) as PickResult;
      } catch {
        // Bank sparse for this strand — skip and try a different one next loop.
        sparseStrands++;
        if (sparseStrands > 5) break; // safety: avoid infinite loop on starved bank
        continue;
      }
      toolsExercised.add('pick_next_item');

      const item = pick.item!;
      const chosenIndex: 0 | 1 | 2 | 3 =
        item.b <= 0
          ? item.correctIndex
          : (((item.correctIndex + 1) % 4) as 0 | 1 | 2 | 3);

      const scoreRes = (await scoreAnswer.execute({
        sessionId,
        itemId: item.id,
        chosenIndex,
        latencyMs: 1000,
      })) as ScoreResult;
      toolsExercised.add('score_answer');

      expect(typeof scoreRes.correct).toBe('boolean');
      expect(typeof scoreRes.newTheta).toBe('number');
      expect(['continue', 'switch_strand', 'finalise']).toContain(
        scoreRes.recommendation,
      );

      if (scoreRes.recommendation === 'finalise') {
        finaliseRecommended = true;
        break;
      }
    }

    // We should have answered at least a few items.
    const midState = (await getSessionState.execute({
      sessionId,
    })) as SessionStateSnapshot;
    expect(midState.historyCount).toBeGreaterThan(0);

    // 4. Finalise.
    const report = (await finaliseAssessment.execute({ sessionId })) as {
      stage: string;
      overallTier: string;
      strands: Record<string, { tier: string; theta: number; confidence: number }>;
      strengths: string[];
      gaps: string[];
      nextSteps: string;
    };
    toolsExercised.add('finalise_assessment');

    expect(['junior_cycle', 'leaving_cert', 'primary']).toContain(report.stage);
    expect(['foundation', 'ordinary', 'higher']).toContain(report.overallTier);
    for (const s of [
      'number',
      'algebra',
      'geometry_trig',
      'functions',
      'statistics_prob',
    ]) {
      expect(report.strands[s]).toBeDefined();
      expect(['foundation', 'ordinary', 'higher']).toContain(
        report.strands[s]!.tier,
      );
    }
    expect(typeof report.nextSteps).toBe('string');
    expect(report.nextSteps.length).toBeGreaterThan(10);

    // 5. Re-finalising should yield the cached report (idempotent).
    const report2 = await finaliseAssessment.execute({ sessionId });
    expect(report2).toEqual(report);

    // We should have exercised five tools end-to-end.
    expect(toolsExercised.size).toBe(5);
    // Either we hit the finalise recommendation organically OR we ran out of
    // items — both are valid loop-exit shapes for this fixture.
    expect(finaliseRecommended || sparseStrands > 0 || midState.historyCount >= 5)
      .toBe(true);
  });
});
