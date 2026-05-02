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
  history: Array<{ itemId: string; correct: boolean; latencyMs: number }>;
  itemsAsked: Set<string>;
  finalised: boolean;
}

export interface AssessmentReport {
  stage: Stage;
  overallTier: Tier;
  strands: Record<Strand, { theta: number; tier: Tier; confidence: number }>;
  strengths: string[];
  gaps: string[];
  nextSteps: string;
}

export type Recommendation = 'continue' | 'switch_strand' | 'finalise';
