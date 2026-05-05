export type QuestionState = 'done' | 'now' | 'next' | 'locked';
export type Mood = 'good' | 'warn' | 'bad' | 'think' | 'happy' | 'sad';

export interface StrokePoint {
  x: number;
  y: number;
  p: number;
}

export interface Stroke {
  tool: 'pen' | 'erase';
  color: string;
  stroke: number;
  points: StrokePoint[];
}

export interface QuestionTemplate {
  id: string;
  section: string;
  topic: string;
  difficulty: number;
  prompt: string;
  answer: string;
  accept?: string[];
  hint?: string;
  /** Backend multiple-choice options (4 strings). Present when item came from API. */
  choices?: [string, string, string, string];
  /** Backend item id — sent back as `itemId` on submit. Mirrors `id` for API items. */
  itemId?: string;
  /** Backend strand — drives sectional grouping in the sidebar. */
  strand?: string;
  /** Curriculum learning outcome string, e.g. "JC.AL.O.4: Factorise quadratics". */
  learningOutcome?: string;
}

export interface Question extends QuestionTemplate {
  state: QuestionState;
  userAnswer: string | null;
  correct: boolean | null;
  strokes: Stroke[];
  recap?: boolean;
  /** Index of the choice the learner selected (multiple-choice mode). */
  chosenIndex?: 0 | 1 | 2 | 3;
}

export interface SectionMeta {
  id: string;
  title: string;
  summary: string;
}

export interface Section extends SectionMeta {
  state: QuestionState;
  questions: Question[];
}

export interface AssessResult {
  items: Question[];
  message: string;
  mood: Mood;
  ribbon: string;
  advanceTo: string;
  correct: boolean | null;
  inserted: string[];
  /** Set when the backend says the assessment is complete. Caller should switch views. */
  report?: import('@/app/api/assessment/types').AssessmentReport;
}

export interface ChatMessage {
  who: 'tutor' | 'you';
  text: string;
  mood?: Mood;
}

export interface SessionStats {
  done: number;
  total: number;
  correct: number;
}
