import type { LuaTool } from 'lua-cli';
import { z } from 'zod';
import { sessions } from '../runtime.js';

export class GetSessionState implements LuaTool {
  name = 'get_session_state';
  description =
    'Return the current ability estimate (theta) and uncertainty (SE) per strand, ' +
    'plus question history. Call at the start of every turn to decide what to do next.';
  inputSchema = z.object({ sessionId: z.string() });

  async execute(input: { sessionId: string }): Promise<unknown> {
    const { sessionId } = input;

    // Idempotent start: if the session doesn't exist, create it. This makes
    // the agent's first turn safe — it can call get_session_state without a
    // separate "start" step.
    let state = await sessions.get(sessionId);
    if (!state) {
      state = await sessions.create(sessionId);
    }

    return {
      sessionId: state.sessionId,
      stageEstimate: state.stageEstimate,
      theta: state.theta,
      se: state.se,
      // Set is not JSON-serialisable; emit an array. Caller treats this as a
      // read-only snapshot — never reaches back into the live state.
      itemsAsked: Array.from(state.itemsAsked),
      historyCount: state.history.length,
      finalised: state.finalised,
    };
  }
}
