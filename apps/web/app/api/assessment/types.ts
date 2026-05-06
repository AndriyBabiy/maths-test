/**
 * Local type mirror for the route handler.
 *
 * Mirrors `@maths-diag/core` shapes deliberately rather than depending on the
 * workspace package — keeps `pnpm typecheck` resilient if the workspace link
 * isn't installed in `apps/web`. Keep these in sync with `packages/core/src/types.ts`.
 */
export type Stage = 'primary' | 'junior_cycle' | 'leaving_cert';

export type Strand =
  | 'number'
  | 'algebra'
  | 'geometry_trig'
  | 'functions'
  | 'statistics_prob'
  | 'measures_data';

export type Tier = 'foundation' | 'ordinary' | 'higher';

export interface Item {
  id: string;
  stage: Stage;
  strand: Strand;
  learningOutcome: string;
  b: number;
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  source: 'anchor' | 'generated';
  khanAcademyRef?: string | null;
}

/** Item shape sent to the UI. `correctIndex` is stripped server-side. */
export type PublicItem = Omit<Item, 'correctIndex'>;

/**
 * Full per-question record carried back on the final report. Populated by
 * `buildReport()` from `SessionState.history` + the item bank. Drives both
 * the per-question review panel in the UI and the study-plan agent's
 * remediation-of-incorrect-items path.
 */
export interface AttemptRecord {
  itemId: string;
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  chosenIndex: 0 | 1 | 2 | 3 | null;
  correct: boolean;
  latencyMs: number;
  strand: Strand;
  learningOutcome: string;
  b: number;
}

export interface AssessmentReport {
  stage: Stage;
  overallTier: Tier;
  strands: Record<Strand, { theta: number; tier: Tier; confidence: number }>;
  strengths: string[];
  gaps: string[];
  nextSteps: string;
  attempts: AttemptRecord[];
}

/**
 * Tagged-union request body. `distinctId` is the PostHog `distinct_id` from
 * the browser — optional because analytics is supplementary, not required for
 * the assessment to function.
 */
export type AssessmentRequest =
  | { kind: 'start'; sessionId: string; distinctId?: string }
  | {
      kind: 'answer';
      sessionId: string;
      distinctId?: string;
      itemId: string;
      chosenIndex: 0 | 1 | 2 | 3;
      latencyMs: number;
    }
  | { kind: 'finalise'; sessionId: string; distinctId?: string };

/** Tagged-union response body. */
export type AssessmentResponse =
  | {
      kind: 'next_item';
      item: PublicItem;
      progress: {
        asked: number;
        cap: number;
        commentary: string;
        /** Whether the previous answer was correct. `null` on `start` (no prior answer). */
        lastCorrect: boolean | null;
      };
    }
  | {
      kind: 'report';
      report: AssessmentReport;
      commentary: string;
      /** Whether the final answer was correct. `null` when reached via `finalise` (no answer). */
      lastCorrect: boolean | null;
    }
  | { kind: 'error'; message: string };