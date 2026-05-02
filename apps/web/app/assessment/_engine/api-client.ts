/**
 * Thin client for `/api/assessment`. The route handler bridges to the deployed
 * Lua agent — see `app/api/assessment/route.ts` for the wire shape and the
 * `<lua-out>` envelope contract.
 *
 * Errors are mapped to a typed `{ kind: 'error' }` shape so callers can
 * pattern-match without `try/catch` plumbing.
 */
import type {
  AssessmentResponse,
  PublicItem,
} from '@/app/api/assessment/types';
import type { Question, QuestionState } from './types';

const ENDPOINT = '/api/assessment';

async function postAssessment(body: unknown): Promise<AssessmentResponse> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as AssessmentResponse;
    return json;
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function apiStart(sessionId: string): Promise<AssessmentResponse> {
  return postAssessment({ kind: 'start', sessionId });
}

export function apiAnswer(args: {
  sessionId: string;
  itemId: string;
  chosenIndex: 0 | 1 | 2 | 3;
  latencyMs: number;
}): Promise<AssessmentResponse> {
  return postAssessment({ kind: 'answer', ...args });
}

export function apiFinalise(sessionId: string): Promise<AssessmentResponse> {
  return postAssessment({ kind: 'finalise', sessionId });
}

/**
 * Friendly strand names. Mirrors `SECTION_META` titles in `content.ts`, but
 * kept here so `publicItemToQuestion` can stay self-contained.
 */
const STRAND_TITLE: Record<string, string> = {
  number: 'Number',
  algebra: 'Algebra',
  geometry_trig: 'Geometry & Trig',
  functions: 'Functions',
  statistics_prob: 'Statistics & Prob',
  measures_data: 'Measures',
};

/**
 * Map backend `b ∈ [-2, 2]` to the wireframe's `difficulty ∈ [1, 5]` for the
 * red-dot indicator in the chat card. Out-of-range values are clamped — the
 * UI only renders the first 3 dots so values above 3 just light all three.
 */
function difficultyFromB(b: number): number {
  return Math.max(1, Math.min(5, Math.round(b + 3)));
}

/** Convert a backend `PublicItem` to a wireframe `Question` in `state='now'`. */
export function publicItemToQuestion(
  item: PublicItem,
  state: QuestionState = 'now',
): Question {
  return {
    id: item.id,
    itemId: item.id,
    section: item.strand,
    strand: item.strand,
    topic: STRAND_TITLE[item.strand] ?? item.strand,
    difficulty: difficultyFromB(item.b),
    prompt: item.text,
    answer: '',
    choices: item.choices,
    state,
    userAnswer: null,
    correct: null,
    strokes: [],
  };
}
