import type { LuaTool } from 'lua-cli';
import { z } from 'zod';
import { engine, getItemById, sessions } from '../runtime.js';

export class ScoreAnswer implements LuaTool {
  name = 'score_answer';
  description =
    'Apply the Rasch 1PL update for the given answer and return a recommendation ' +
    "('continue' | 'switch_strand' | 'finalise'). Call after every answer. The agent " +
    'may override the recommendation when learner-facing judgement demands it.';
  inputSchema = z.object({
    sessionId: z.string(),
    itemId: z.string(),
    chosenIndex: z.number().int().min(0).max(3),
    latencyMs: z.number().int().nonnegative(),
  });

  async execute(input: {
    sessionId: string;
    itemId: string;
    chosenIndex: 0 | 1 | 2 | 3;
    latencyMs: number;
  }): Promise<unknown> {
    const { sessionId, itemId, chosenIndex, latencyMs } = input;

    const state = await sessions.get(sessionId);
    if (!state) {
      throw new Error(`[score_answer] Unknown session: ${sessionId}`);
    }

    const item = getItemById(itemId);
    if (!item) {
      throw new Error(`[score_answer] Unknown item: ${itemId}`);
    }

    const correct = chosenIndex === item.correctIndex;
    const newState = engine.update(state, item, correct, latencyMs);
    const recommendation = engine.recommend(newState, item.strand);

    await sessions.update(sessionId, () => newState);

    return {
      correct,
      newTheta: newState.theta[item.strand],
      newSE: newState.se[item.strand],
      recommendation,
    };
  }
}
