/**
 * LangGraph state annotation for the diagnostic agent.
 *
 * Wraps the canonical `SessionState` shape from `@maths-diag/core` plus
 * a handful of per-turn fields that flow between nodes:
 *   - lastAnswer  : populated before scoreAnswerNode
 *   - nextItem    : produced by pickItemNode, consumed by narrate / response
 *   - report      : produced by finaliseNode
 *   - recommendation : produced by scoreAnswerNode, gates the conditional edge
 *   - commentary  : produced by narrate / finalise, returned to the UI
 */
import { Annotation } from '@langchain/langgraph';
import type {
  AssessmentReport,
  Item,
  Recommendation,
  SessionState,
  Stage,
  Strand,
} from '@maths-diag/core';

export interface LastAnswer {
  itemId: string;
  chosenIndex: 0 | 1 | 2 | 3;
  latencyMs: number;
  correct: boolean;
}

const EMPTY_THETA = {
  number: 0,
  algebra: 0,
  geometry_trig: 0,
  functions: 0,
  statistics_prob: 0,
  measures_data: 0,
} as Record<Strand, number>;
const EMPTY_SE = {
  number: 1,
  algebra: 1,
  geometry_trig: 1,
  functions: 1,
  statistics_prob: 1,
  measures_data: 1,
} as Record<Strand, number>;

export const AgentState = Annotation.Root({
  // --- SessionState fields, flattened ---
  sessionId: Annotation<string>({ reducer: (_, n) => n, default: () => '' }),
  stageEstimate: Annotation<Stage | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  theta: Annotation<Record<Strand, number>>({
    reducer: (_, n) => n,
    default: () => ({ ...EMPTY_THETA }),
  }),
  se: Annotation<Record<Strand, number>>({
    reducer: (_, n) => n,
    default: () => ({ ...EMPTY_SE }),
  }),
  history: Annotation<SessionState['history']>({
    reducer: (_, n) => n,
    default: () => [],
  }),
  itemsAsked: Annotation<Set<string>>({
    reducer: (_, n) => n,
    default: () => new Set<string>(),
  }),
  finalised: Annotation<boolean>({
    reducer: (_, n) => n,
    default: () => false,
  }),

  // --- per-turn fields ---
  lastAnswer: Annotation<LastAnswer | undefined>({
    reducer: (_, n) => n,
    default: () => undefined,
  }),
  nextItem: Annotation<Item | undefined>({
    reducer: (_, n) => n,
    default: () => undefined,
  }),
  report: Annotation<AssessmentReport | undefined>({
    reducer: (_, n) => n,
    default: () => undefined,
  }),
  recommendation: Annotation<Recommendation | undefined>({
    reducer: (_, n) => n,
    default: () => undefined,
  }),
  commentary: Annotation<string>({ reducer: (_, n) => n, default: () => '' }),
});

export type AgentStateType = typeof AgentState.State;
export type AgentStateUpdate = typeof AgentState.Update;

/** Pull a `SessionState` view from the graph state for engine calls. */
export function toSessionState(s: AgentStateType): SessionState {
  return {
    sessionId: s.sessionId,
    stageEstimate: s.stageEstimate,
    theta: s.theta,
    se: s.se,
    history: s.history,
    itemsAsked: s.itemsAsked,
    finalised: s.finalised,
  };
}

/** Spread a `SessionState` back into a graph patch. */
export function fromSessionState(s: SessionState): AgentStateUpdate {
  return {
    sessionId: s.sessionId,
    stageEstimate: s.stageEstimate,
    theta: s.theta,
    se: s.se,
    history: s.history,
    itemsAsked: s.itemsAsked,
    finalised: s.finalised,
  };
}
