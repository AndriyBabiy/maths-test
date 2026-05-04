import type { AssessmentResponse } from '@/app/api/assessment/types';
import { apiAnswer, publicItemToQuestion } from './api-client';
import { SECTION_META } from './content';
import type { AssessResult, Mood, Question, Section } from './types';

/**
 * Correctness comes from the server envelope's `lastCorrect: boolean | null`
 * field — the agent computes `item.correctIndex === chosenIndex` server-side
 * and forwards that boolean. `null` means no answer was scored on this turn
 * (e.g. the `start` envelope or a `finalise` that wasn't preceded by an
 * answer in the same call), in which case the sidebar shows a neutral marker.
 */

function moodFromCorrect(correct: boolean | null): Mood {
  if (correct === true) return 'good';
  if (correct === false) return 'bad';
  return 'warn';
}

function ribbonFromCorrect(correct: boolean | null): string {
  if (correct === true) return '✓ noted · adapting';
  if (correct === false) return '✗ noted · trying a different angle';
  return 'noted — adapting…';
}

/**
 * Submit an answer to the in-process LangGraph agent and fold the response
 * into the wireframe's `Question[]` state.
 *
 * Side effects (encoded in the returned `items` array, not in the original):
 *  - Marks the active question `done`, stamps `userAnswer` + `chosenIndex` +
 *    inferred `correct`.
 *  - On a `next_item` response, appends a new `Question` in `state='now'`.
 *  - On a `report` response, no new question — caller should switch to the
 *    report view (see `result.report`).
 *  - On `error`, leaves the active question marked done with `correct=null`
 *    and surfaces the error text via `message`.
 */
export async function assessAndAdapt(
  items: Question[],
  activeId: string,
  chosenIndex: 0 | 1 | 2 | 3,
  args: { sessionId: string; latencyMs: number },
): Promise<AssessResult> {
  const next: Question[] = items.map((q) => ({ ...q }));
  const idx = next.findIndex((q) => q.id === activeId);
  if (idx < 0) {
    return {
      items: next,
      message: 'Lost track of the active question — please reset.',
      mood: 'warn',
      ribbon: '',
      advanceTo: activeId,
      correct: null,
      inserted: [],
    };
  }

  const q = next[idx]!;
  const itemId = q.itemId ?? q.id;
  const choiceText = q.choices?.[chosenIndex] ?? `(choice ${chosenIndex + 1})`;

  // Optimistically stamp the chosen answer; the API will tell us if it was right.
  q.userAnswer = choiceText;
  q.chosenIndex = chosenIndex;
  q.state = 'done';

  let response: AssessmentResponse;
  try {
    response = await apiAnswer({
      sessionId: args.sessionId,
      itemId,
      chosenIndex,
      latencyMs: args.latencyMs,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      items: next,
      message: `Network error talking to the agent: ${detail}`,
      mood: 'warn',
      ribbon: 'connection issue',
      advanceTo: q.id,
      correct: null,
      inserted: [],
    };
  }

  if (response.kind === 'error') {
    return {
      items: next,
      message: response.message,
      mood: 'warn',
      ribbon: 'agent error',
      advanceTo: q.id,
      correct: null,
      inserted: [],
    };
  }

  if (response.kind === 'report') {
    const correct = response.lastCorrect;
    q.correct = correct;
    return {
      items: next,
      message: response.commentary || 'Assessment complete — generating report.',
      mood: 'happy',
      ribbon: 'assessment complete',
      advanceTo: q.id,
      correct,
      inserted: [],
      report: response.report,
    };
  }

  // kind === 'next_item' — fold the new item in as `now`.
  const correct = response.progress.lastCorrect;
  q.correct = correct;

  const newQ = publicItemToQuestion(response.item, 'now');
  // Guard: if the agent re-emits the same item id, don't duplicate.
  const existing = next.find((x) => x.id === newQ.id);
  const inserted: string[] = [];
  if (!existing) {
    next.push(newQ);
    inserted.push(newQ.id);
  }

  return {
    items: next,
    message: response.progress.commentary || 'On to the next one.',
    mood: moodFromCorrect(correct),
    ribbon: ribbonFromCorrect(correct),
    advanceTo: existing ? existing.id : newQ.id,
    correct,
    inserted,
  };
}

/**
 * Group questions by strand using the canonical `SECTION_META` order.
 * Preserves the wireframe's collapsible-sections sidebar without changes.
 */
export function groupBySection(items: Question[]): Section[] {
  const out: Section[] = [];
  for (const meta of SECTION_META) {
    const qs = items.filter((q) => q.section === meta.id);
    if (!qs.length) continue;
    let state: Section['state'] = 'next';
    if (qs.every((q) => q.state === 'done')) state = 'done';
    else if (qs.some((q) => q.state === 'now')) state = 'now';
    else if (qs.every((q) => q.state === 'locked')) state = 'locked';
    out.push({ ...meta, state, questions: qs });
  }
  return out;
}
