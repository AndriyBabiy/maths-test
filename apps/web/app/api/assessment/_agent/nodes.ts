/**
 * Pure node implementations for the diagnostic graph.
 *
 * Each node returns a state PATCH (partial update) — never mutates input
 * state. Engine math lives in `RaschEngine`; report-building in
 * `buildReport`. The only I/O is the LLM call inside `narrateNode`.
 */
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import {
  ITEMS,
  RaschEngine,
  buildReport,
  type Item,
  type Strand,
} from '@maths-diag/core';
import { createLLM } from './llm';
import { traceLLM } from '../../_lib/llm-trace';
import {
  type AgentStateType,
  type AgentStateUpdate,
  fromSessionState,
  toSessionState,
} from './state';

const engine = new RaschEngine();

// Strand selection candidates: same active set the engine uses to decide
// when to finalise. `measures_data` is primary-only; for JC/LC the diagnostic
// covers these five.
const ACTIVE_STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
];

/**
 * Pick the strand to probe next: highest SE, tie-break by lower theta,
 * then by alphabetical strand name. Skips strands whose item bank for the
 * current stage is exhausted.
 */
function pickStrand(state: AgentStateType): Strand {
  const sessionState = toSessionState(state);
  // Candidates: strand has at least one un-asked item compatible with stage.
  const stage = state.stageEstimate;
  const hasItems = (s: Strand): boolean =>
    ITEMS.some(
      (it) =>
        it.strand === s &&
        !state.itemsAsked.has(it.id) &&
        (stage === null || it.stage === stage),
    );

  const candidates = ACTIVE_STRANDS.filter(hasItems);
  // If somehow no active strand has items left, fall back to any active
  // strand — pickItem will return null and the caller will short-circuit.
  const pool = candidates.length > 0 ? candidates : ACTIVE_STRANDS;

  return [...pool].sort((a, b) => {
    const seDiff = sessionState.se[b] - sessionState.se[a];
    if (seDiff !== 0) return seDiff;
    const thetaDiff = sessionState.theta[a] - sessionState.theta[b];
    if (thetaDiff !== 0) return thetaDiff;
    return a.localeCompare(b);
  })[0]!;
}

export function pickItemNode(state: AgentStateType): AgentStateUpdate {
  const strand = pickStrand(state);
  const sessionState = toSessionState(state);
  const itemsList = ITEMS as unknown as Item[];
  // Streak boost expands the picker's reach: a hot streak in algebra targets
  // LC HL items at b≈+1.5 to +3.0, a cold streak drops to primary fundamentals
  // at b≈-2 to -3. Without this, theta only moves into JC OL range within the
  // per-strand item budget and learners never see edges of the curriculum.
  const streakBoost = engine.streakBoost(sessionState.history, strand, itemsList);
  const item = engine.pickItem(itemsList, sessionState, strand, { streakBoost });
  if (!item) {
    return { nextItem: undefined };
  }
  return { nextItem: item };
}

export function scoreAnswerNode(state: AgentStateType): AgentStateUpdate {
  const last = state.lastAnswer;
  if (!last) throw new Error('scoreAnswerNode requires state.lastAnswer');
  const item = ITEMS.find((it) => it.id === last.itemId);
  if (!item) throw new Error(`Unknown itemId: ${last.itemId}`);

  const sessionState = toSessionState(state);
  const updated = engine.update(
    sessionState,
    item,
    last.correct,
    last.latencyMs,
    last.chosenIndex,
  );
  const recommendation = engine.recommend(updated, item.strand);

  return {
    ...fromSessionState(updated),
    recommendation,
  };
}

const CommentarySchema = z.object({
  commentary: z.string().min(1).max(220),
});

export async function narrateNode(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<AgentStateUpdate> {
  const item = state.nextItem;
  // Without a next item there's nothing to narrate; let the caller decide.
  if (!item) return { commentary: '' };

  const previous = state.lastAnswer;
  const asked = state.itemsAsked.size;

  const guidance =
    previous === undefined
      ? `This is the first question of the diagnostic. Welcome the learner warmly in one sentence.`
      : `The learner has answered ${asked} question${asked === 1 ? '' : 's'} so far. Encourage them to keep going. Do NOT reveal whether the previous answer was correct.`;

  const prompt = [
    `You are a friendly maths tutor producing a short one-line message before the next question.`,
    guidance,
    `The next question covers strand "${item.strand}" at difficulty b=${item.b.toFixed(2)} (negative=easier).`,
    `Constraints: 1 sentence, under 200 chars, encouraging tone, no exclamation overload, no spoilers.`,
  ].join('\n');

  // distinctId comes through `configurable` so PostHog `$ai_generation` events
  // join the same person record as client-side product events. Falls back to
  // sessionId when the route handler didn't attach one.
  const configurable = config?.configurable as
    | { distinctId?: string }
    | undefined;
  const distinctId = configurable?.distinctId ?? state.sessionId;

  // LLM commentary is supplementary — never let an OpenRouter/key/network
  // failure block the assessment flow. Math + item picking are pure and
  // already complete by the time this node runs.
  try {
    const llm = createLLM().withStructuredOutput(CommentarySchema, {
      name: 'commentary',
    });
    const out = await traceLLM(llm, prompt, {
      distinctId,
      traceId: state.sessionId,
      spanName: 'assessment_narrate',
      provider: 'openrouter',
      model: process.env.OPENROUTER_MODEL ?? 'anthropic/claude-haiku-4.5',
      properties: {
        assessment_session_id: state.sessionId,
        strand: item.strand,
        item_id: item.id,
        item_b: item.b,
        items_asked: asked,
      },
    });
    return { commentary: out.commentary };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[assessment] narrate: LLM unavailable, continuing silently (${detail})`);
    return { commentary: '' };
  }
}

export function finaliseNode(state: AgentStateType): AgentStateUpdate {
  const sessionState = toSessionState(state);
  const report = buildReport(sessionState);
  // Closing one-liner that summarises overall tier without naming strand thetas.
  const tierBlurb: Record<typeof report.overallTier, string> = {
    foundation:
      'Great effort working through this diagnostic — your foundation level results show plenty of room to build skills.',
    ordinary:
      'Nice work — your overall results sit in the ordinary range, with clear opportunities to push further.',
    higher:
      'Strong work — your overall results land in the higher range across most strands.',
  };
  return {
    finalised: true,
    report,
    commentary: tierBlurb[report.overallTier],
  };
}

/** Conditional-edge router: where to go after scoring. */
export function routeAfterScore(state: AgentStateType): 'finalise' | 'continue' {
  return state.recommendation === 'finalise' ? 'finalise' : 'continue';
}
