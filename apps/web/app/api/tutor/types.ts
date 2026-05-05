/**
 * Wire shape for the LLM tutor chat. The route handler at `./route.ts`
 * fronts a single OpenRouter-backed LLM call — short coaching reply, no
 * streaming, no persisted history (the client passes the recent window).
 */
export interface TutorQuestion {
  /** Question text as shown to the student (LaTeX with $…$ allowed). */
  text: string;
  /** Multiple-choice options as displayed. */
  choices: [string, string, string, string];
  /** e.g. "algebra", "geometry_trig" — used to anchor the tutor's framing. */
  strand: string;
  /** e.g. "JC.AL.O.4: Factorise quadratic expressions". */
  learningOutcome: string;
}

export interface TutorTurn {
  who: 'tutor' | 'you';
  text: string;
}

export interface TutorRequest {
  sessionId: string;
  /** `null` when the chat opens before the first question loads. */
  question: TutorQuestion | null;
  /** Recent conversation window (client-side cap is ~10). */
  history: TutorTurn[];
  /** New student message to coach against. */
  message: string;
}

export type TutorResponse =
  | { kind: 'reply'; text: string }
  | { kind: 'error'; message: string };
