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

export interface AssessmentReport {
  stage: Stage;
  overallTier: Tier;
  strands: Record<Strand, { theta: number; tier: Tier; confidence: number }>;
  strengths: string[];
  gaps: string[];
  nextSteps: string;
}

/** Tagged-union request body. */
export type AssessmentRequest =
  | { kind: 'start'; sessionId: string }
  | {
      kind: 'answer';
      sessionId: string;
      itemId: string;
      chosenIndex: 0 | 1 | 2 | 3;
      latencyMs: number;
    }
  | { kind: 'finalise'; sessionId: string };

/** Tagged-union response body. */
export type AssessmentResponse =
  | {
      kind: 'next_item';
      item: PublicItem;
      progress: { asked: number; cap: number; commentary: string };
    }
  | {
      kind: 'report';
      report: AssessmentReport;
      commentary: string;
    }
  | { kind: 'error'; message: string };