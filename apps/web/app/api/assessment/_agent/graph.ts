/**
 * Three small LangGraph graphs for the diagnostic agent.
 *
 * WHY per-action sub-graphs (start / answer / finalise) instead of one
 * monolithic graph: each public surface (HTTP request kind) maps to a
 * distinct linear flow with its own START. Splitting them up keeps the
 * state machine obvious and lets us share the same `MemorySaver` so all
 * three see the same per-session checkpoint.
 *
 * WHY MemorySaver: LangGraph's checkpointing keeps a persisted view of
 * the state per `thread_id`. We use `sessionId` as `thread_id`, so
 * subsequent graph invocations for the same learner restore the latest
 * theta/SE/itemsAsked. The session-store module is the source of truth
 * for the SessionState contract; checkpointing is the LangGraph mechanism
 * that wires it through the graph runtime.
 */
import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { AgentState } from './state';
import {
  finaliseNode,
  narrateNode,
  pickItemNode,
  routeAfterScore,
  scoreAnswerNode,
} from './nodes';

// Single shared checkpointer so all three graphs share thread state.
const checkpointer = new MemorySaver();

// ---- start graph: pick → narrate → END ------------------------------------
const startGraphBuilder = new StateGraph(AgentState)
  .addNode('pickItem', pickItemNode)
  .addNode('narrate', narrateNode)
  .addEdge(START, 'pickItem')
  .addEdge('pickItem', 'narrate')
  .addEdge('narrate', END);

export const startGraph = startGraphBuilder.compile({ checkpointer });

// ---- answer graph: score → (finalise | pick → narrate) → END --------------
const answerGraphBuilder = new StateGraph(AgentState)
  .addNode('scoreAnswer', scoreAnswerNode)
  .addNode('pickItem', pickItemNode)
  .addNode('narrate', narrateNode)
  .addNode('finalise', finaliseNode)
  .addEdge(START, 'scoreAnswer')
  .addConditionalEdges('scoreAnswer', routeAfterScore, {
    finalise: 'finalise',
    continue: 'pickItem',
  })
  .addEdge('pickItem', 'narrate')
  .addEdge('narrate', END)
  .addEdge('finalise', END);

export const answerGraph = answerGraphBuilder.compile({ checkpointer });

// ---- finalise graph: finalise → END ---------------------------------------
const finaliseGraphBuilder = new StateGraph(AgentState)
  .addNode('finalise', finaliseNode)
  .addEdge(START, 'finalise')
  .addEdge('finalise', END);

export const finaliseGraph = finaliseGraphBuilder.compile({ checkpointer });
