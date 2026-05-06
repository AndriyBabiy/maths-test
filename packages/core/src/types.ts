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

export interface SessionState {
  sessionId: string;
  stageEstimate: Stage | null;
  theta: Record<Strand, number>;
  se: Record<Strand, number>;
  /**
   * Per-turn record. `chosenIndex` is optional only for backwards compat
   * with older tests; production code should always populate it so the
   * report can show the learner which option they picked on each item.
   */
  history: Array<{
    itemId: string;
    correct: boolean;
    latencyMs: number;
    chosenIndex?: 0 | 1 | 2 | 3;
  }>;
  itemsAsked: Set<string>;
  finalised: boolean;
}

/**
 * Reconstructed per-question record on the final report. Carries the full
 * item text + choices so the UI can render a question-by-question review,
 * and so the study-plan agent can target specific incorrect items with
 * remediation guidance.
 */
export interface AttemptRecord {
  itemId: string;
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Null when the learner never answered (e.g. session finalised mid-flight). */
  chosenIndex: 0 | 1 | 2 | 3 | null;
  correct: boolean;
  latencyMs: number;
  strand: Strand;
  learningOutcome: string;
  /** Item difficulty so the UI / study-plan can sort by hardness. */
  b: number;
}

export interface AssessmentReport {
  stage: Stage;
  overallTier: Tier;
  strands: Record<Strand, { theta: number; tier: Tier; confidence: number }>;
  strengths: string[];
  gaps: string[];
  nextSteps: string;
  /**
   * Full per-question history reconstructed from `SessionState.history` +
   * the item bank. Newest-first preserves insertion order.
   */
  attempts: AttemptRecord[];
}

export type Recommendation = 'continue' | 'switch_strand' | 'finalise';
