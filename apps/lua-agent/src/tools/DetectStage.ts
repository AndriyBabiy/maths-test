import type { LuaTool } from 'lua-cli';
import { z } from 'zod';
import { detectStageFromProbes } from '@maths-diag/core';
import { sessions } from '../runtime.js';

export class DetectStage implements LuaTool {
  name = 'detect_stage';
  description =
    'Score a stage-router probe. Used in the first 1-2 turns only to classify the ' +
    "learner's stage (primary / junior_cycle / leaving_cert) before adaptive testing begins.";
  inputSchema = z.object({
    sessionId: z.string(),
    q1Correct: z.boolean(),
    // Allow omitting q2 entirely (provisional after one probe) or sending null.
    q2Correct: z.boolean().nullable().optional(),
  });

  async execute(input: {
    sessionId: string;
    q1Correct: boolean;
    q2Correct?: boolean | null;
  }): Promise<unknown> {
    const { sessionId, q1Correct } = input;
    const q2Correct = input.q2Correct ?? null;

    // Ensure session exists — DetectStage might be called before
    // GetSessionState in some agent flows.
    if (!(await sessions.get(sessionId))) {
      await sessions.create(sessionId);
    }

    const result = detectStageFromProbes(q1Correct, q2Correct);

    // Persist the inferred stage so subsequent pick_next_item calls can
    // filter by it.
    await sessions.update(sessionId, (s) => ({
      ...s,
      stageEstimate: result.stage,
    }));

    return { stage: result.stage, confidence: result.confidence };
  }
}
