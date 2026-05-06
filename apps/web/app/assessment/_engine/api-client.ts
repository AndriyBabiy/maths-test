/**
 * Thin client for `/api/assessment`. The route handler delegates to the
 * in-process LangGraph agent at `apps/web/app/api/assessment/_agent/` —
 * see `app/api/assessment/route.ts` for the wire shape.
 *
 * Errors are mapped to a typed `{ kind: 'error' }` shape so callers can
 * pattern-match without `try/catch` plumbing.
 *
 * Every request includes the PostHog `distinct_id` from the browser when
 * available — that lets server-side `$ai_generation` events join the same
 * person record as client product events. PostHog is loaded lazily (and may
 * be ad-blocked), so the lookup is best-effort.
 */
import posthog from 'posthog-js';
import type {
  AssessmentResponse,
  PublicItem,
} from '@/app/api/assessment/types';
import type { TutorRequest, TutorResponse } from '@/app/api/tutor/types';
import type { Question, QuestionState } from './types';

const ENDPOINT = '/api/assessment';
const TUTOR_ENDPOINT = '/api/tutor';

/**
 * Read PostHog's anonymous distinctId off the global singleton. Returns
 * undefined when PostHog isn't initialised yet (env key missing, ad-blocker)
 * or when called during SSR.
 */
function getDistinctId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const id = posthog.get_distinct_id?.();
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  }
}

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
  return postAssessment({
    kind: 'start',
    sessionId,
    distinctId: getDistinctId(),
  });
}

export function apiAnswer(args: {
  sessionId: string;
  itemId: string;
  chosenIndex: 0 | 1 | 2 | 3;
  latencyMs: number;
}): Promise<AssessmentResponse> {
  return postAssessment({ kind: 'answer', ...args, distinctId: getDistinctId() });
}

export function apiFinalise(sessionId: string): Promise<AssessmentResponse> {
  return postAssessment({
    kind: 'finalise',
    sessionId,
    distinctId: getDistinctId(),
  });
}

/**
 * POST a tutor turn. Network/parse failures collapse into a typed error so
 * callers can branch on `kind` without their own try/catch.
 */
export async function apiTutor(req: TutorRequest): Promise<TutorResponse> {
  try {
    const res = await fetch(TUTOR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The body already carries `strokesPng` when the student has working on
      // the pad — the spread copies it through. distinctId falls back to the
      // PostHog browser id so server-side $ai_generation events join up.
      body: JSON.stringify({ ...req, distinctId: req.distinctId ?? getDistinctId() }),
    });
    const json = (await res.json()) as TutorResponse;
    return json;
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
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
    learningOutcome: item.learningOutcome,
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
