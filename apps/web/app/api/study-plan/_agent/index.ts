/**
 * Study-plan generation agent.
 *
 * Inputs: a finalised AssessmentReport + a StudyPlanInput from the HITL form.
 * Outputs: a StudyPlan — deterministic priorities computed in core, the
 * per-week schedule produced by the LLM under a Zod schema.
 *
 * The skill spec at `~/.claude/skills/study-plan-builder/SKILL.md` is the
 * canonical reference for the prompt layout used here. Keep them in sync.
 */
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import {
  computeStrandPriorities,
  strandLabel,
  weeksUntil,
  type AssessmentReport,
  type StrandPriority,
  type StudyPlan,
  type StudyPlanInput,
} from '@maths-diag/core';
import { traceLLM } from '../../_lib/llm-trace';

/**
 * Local LLM factory with JSON response_format pinned via modelKwargs.
 * The shared `createLLM()` in the assessment agent doesn't enable
 * response_format, and `.bind({ response_format })` on its instance
 * doesn't survive Next.js's webpack wrapping in this route handler —
 * so we instantiate ChatOpenAI directly here and pass the kwarg through
 * the constructor instead.
 */
function createPlanLLM(): ChatOpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-haiku-4.5';
  return new ChatOpenAI({
    apiKey,
    model,
    configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    temperature: 0.4,
    modelKwargs: { response_format: { type: 'json_object' } },
  });
}

/** Defensive fence-strip — providers occasionally wrap JSON in ```json blocks. */
function stripJsonFences(s: string): string {
  const trimmed = s.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const m = trimmed.match(fence);
  return m ? m[1]!.trim() : trimmed;
}

const STRAND_ALIAS: Record<string, string> = {
  // canonical IDs map to themselves
  number: 'number',
  algebra: 'algebra',
  geometry_trig: 'geometry_trig',
  functions: 'functions',
  statistics_prob: 'statistics_prob',
  measures_data: 'measures_data',
  // common label drift the LLM produces
  'geometry & trigonometry': 'geometry_trig',
  'geometry and trigonometry': 'geometry_trig',
  'geometry-trig': 'geometry_trig',
  geometry: 'geometry_trig',
  trigonometry: 'geometry_trig',
  'statistics & probability': 'statistics_prob',
  'statistics and probability': 'statistics_prob',
  statistics: 'statistics_prob',
  probability: 'statistics_prob',
  'measures & data': 'measures_data',
  'measures and data': 'measures_data',
  measures: 'measures_data',
};

/**
 * Coerce LLM-emitted strand strings (often Title Case or with ampersands)
 * back to the canonical enum. "All"/unknowns fall back to the highest-
 * priority strand so revision weeks attribute to a real strand instead of
 * tripping the schema and dropping the whole plan to the skeleton.
 */
function normalizeLLMPlan(raw: unknown, priorities: StrandPriority[]): unknown {
  const fallback = priorities[0]?.strand ?? 'algebra';
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as { weeks?: unknown };
  if (!Array.isArray(obj.weeks)) return raw;
  for (const week of obj.weeks as Array<{ topics?: unknown }>) {
    if (!week || !Array.isArray(week.topics)) continue;
    for (const topic of week.topics as Array<{ strand?: unknown }>) {
      if (!topic || typeof topic.strand !== 'string') continue;
      const key = topic.strand.trim().toLowerCase();
      topic.strand = STRAND_ALIAS[key] ?? fallback;
    }
  }
  return raw;
}

const IncorrectItemRecapSchema = z.object({
  questionText: z.string().min(3).max(400),
  chosenAnswer: z.string().min(1).max(200),
  correctAnswer: z.string().min(1).max(200),
  trap: z.string().min(5).max(220),
});

/** Zod schema mirrors the StudyTopic / StudyWeek interfaces in core. */
const TopicSchema = z.object({
  strand: z.enum([
    'number',
    'algebra',
    'geometry_trig',
    'functions',
    'statistics_prob',
    'measures_data',
  ]),
  learningOutcome: z.string().min(1).max(60),
  title: z.string().min(3).max(80),
  rationale: z.string().min(10).max(200),
  hours: z.number().min(0.25).max(20),
  practiceHint: z.string().min(5).max(220),
  /**
   * Optional pointer back to specific diagnostic mistakes this topic addresses.
   * Capped at 3 to keep the PDF readable. Omitted when the LLM has nothing
   * concrete to attach (e.g. generic practice weeks).
   */
  relatedIncorrectItems: z.array(IncorrectItemRecapSchema).max(3).optional(),
});

const WeekSchema = z.object({
  weekNumber: z.number().int().min(1).max(104),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.string().min(3).max(80),
  topics: z.array(TopicSchema).min(1).max(6),
  milestone: z.string().min(5).max(220),
});

const PlanSchema = z.object({
  weeks: z.array(WeekSchema).min(1).max(52),
  summary: z.string().min(20).max(800),
  caveats: z.array(z.string().min(3).max(220)).max(5),
});

type LLMPlan = z.infer<typeof PlanSchema>;

/** Convert YYYY-MM-DD → ISO at 00:00 UTC. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Compute the inclusive [start, end] for a 1-indexed week number. */
function weekRange(startIso: string, weekNumber: number): { start: string; end: string } {
  const start = new Date(startIso);
  start.setUTCDate(start.getUTCDate() + (weekNumber - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: isoDate(start), end: isoDate(end) };
}

/**
 * Build the user prompt for the LLM. Inlines:
 *  - the assessment report (per-strand theta + tier)
 *  - the user's goal (target tier + date + hours)
 *  - the deterministic priority list (gap analysis)
 *  - week range constraints (start, end, count)
 *
 * The LLM is constrained to fill in `weeks[]`, `summary`, and `caveats[]`.
 */
function buildPrompt(
  report: AssessmentReport,
  input: StudyPlanInput,
  priorities: StrandPriority[],
  totalWeeks: number,
  startIso: string,
): string {
  const lines: string[] = [];
  lines.push(
    'You are an Irish maths curriculum coach producing a personalised study plan.',
    'Output JSON matching the schema. Do not invent strand names beyond the six allowed values.',
    '',
    '## Learner snapshot',
    `Stage: ${report.stage}`,
    `Overall current tier: ${report.overallTier}`,
    `Goal tier: ${input.goalTier}`,
    `Target date: ${input.targetDate}`,
    `Weekly study budget: ${input.weeklyHours} hours`,
    `Plan length: ${totalWeeks} week${totalWeeks === 1 ? '' : 's'}`,
    `Plan start (week 1): ${startIso}`,
  );
  if (input.notes && input.notes.trim()) {
    lines.push(`Learner notes: ${input.notes.trim()}`);
  }

  lines.push(
    '',
    '## Per-strand state (theta = ability, higher = stronger)',
    'Each line shows: strand_id (Human Label) → state. ALWAYS use the lowercase strand_id in your JSON output.',
  );
  for (const s of priorities) {
    const ds = report.strands[s.strand];
    const theta = ds ? ds.theta.toFixed(2) : 'n/a';
    const conf = ds ? `${(ds.confidence * 100).toFixed(0)}%` : 'n/a';
    lines.push(
      `  ${s.strand} (${strandLabel(s.strand)}) → current ${s.currentTier} (theta ${theta}, conf ${conf}); ` +
        `goal ${s.goalTier}; gap ${s.gap}; focus: ${s.focus}`,
    );
  }

  if (report.gaps.length > 0) {
    lines.push('', '## Diagnosed gaps (learning outcomes the learner missed)');
    for (const g of report.gaps) lines.push(`  - ${g}`);
  }
  if (report.strengths.length > 0) {
    lines.push('', '## Diagnosed strengths');
    for (const s of report.strengths) lines.push(`  - ${s}`);
  }

  // Concrete misconceptions: feed up to 8 wrong attempts so the LLM can attach
  // specific recaps to whichever weekly topic best covers the underlying skill.
  // Cap at 8 to keep the prompt budget predictable; the rest of the wrong
  // answers are still reflected in `report.gaps` aggregated by LO.
  const wrong = report.attempts.filter((a) => !a.correct).slice(0, 8);
  if (wrong.length > 0) {
    lines.push(
      '',
      '## Specific questions the learner got wrong',
      'Use these to populate `relatedIncorrectItems` on whichever topic best covers the underlying skill.',
      'Each entry below shows: strand · LO · question text · chosen vs correct option.',
    );
    for (const a of wrong) {
      const chosen =
        a.chosenIndex === null ? '(no answer)' : a.choices[a.chosenIndex];
      const correct = a.choices[a.correctIndex];
      lines.push(
        `  - [${a.strand}] ${a.learningOutcome} · "${a.text}" · picked: "${chosen}" · correct: "${correct}"`,
      );
    }
  }

  lines.push(
    '',
    '## Constraints',
    `- Produce exactly ${totalWeeks} week object${totalWeeks === 1 ? '' : 's'}, weekNumber 1..${totalWeeks}.`,
    `- For week N, startDate = ${startIso} + 7*(N-1) days, endDate = startDate + 6 days. Use ISO YYYY-MM-DD.`,
    `- Sum of topic hours per week must be within ±1 of ${input.weeklyHours}.`,
    '- Earlier weeks: build foundations on highest-gap strands (gap=2 first).',
    '- Mid-plan: bridge to goal tier with exam-style practice.',
    '- Final 2 weeks: mocks, mixed revision, light load (no new concepts).',
    '- topic.strand MUST be exactly one of: number, algebra, geometry_trig, functions, statistics_prob, measures_data (lowercase, with underscores). NEVER use human labels like "Algebra" or "Geometry & Trigonometry" in the strand field.',
    '- For mock/revision weeks, pick the single strand most relevant to that revision block — never use "All", "Mixed", or any other placeholder.',
    '- Each topic.title is plain English (no LaTeX). title can use words like "quadratics", "sine rule".',
    '- learningOutcome is a short curriculum tag, e.g. "JC.AL.QUAD" or "LC.FN.DERIV".',
    '- practiceHint should mention concrete sources: past papers, Khan Academy topic, Project Maths exemplars.',
    '- milestone is a measurable checkpoint ("80% on Khan unit X", "complete one full Paper 2").',
    '- summary is one paragraph (≤800 chars) speaking directly to the learner.',
    '- Caveats: optional 0-3 short notes (e.g. "exam in 2 weeks: skip new content").',
    '- relatedIncorrectItems: when wrong-question entries are listed above, attach 1–3 of them to the topic whose skill they exercise. Use the literal `questionText`, `chosenAnswer`, and `correctAnswer` strings; write a one-sentence `trap` describing the misconception (e.g. "treated x^2 as 2x"). Omit the field on topics with no relevant wrong items.',
  );
  return lines.join('\n');
}

/** Public agent entrypoint. */
export async function buildStudyPlan(
  report: AssessmentReport,
  input: StudyPlanInput,
  tracing?: { distinctId: string; traceId?: string },
): Promise<StudyPlan> {
  const totalWeeks = weeksUntil(input.targetDate);
  const priorities = computeStrandPriorities(report, input);
  const startIso = isoDate(new Date());

  const prompt = buildPrompt(report, input, priorities, totalWeeks, startIso);

  let llmPlan: LLMPlan;
  try {
    // JSON-mode + manual Zod parse is more portable than withStructuredOutput
    // across OpenRouter providers — Gemini in particular rejects schemas with
    // string regex constraints when handed via the function-calling path.
    const llm = createPlanLLM();
    const jsonInstruction =
      '\n\nRespond ONLY with a JSON object matching this TypeScript shape (no markdown, no prose, no comments):\n' +
      '{\n' +
      '  "weeks": [{\n' +
      '    "weekNumber": number,\n' +
      '    "startDate": "YYYY-MM-DD",\n' +
      '    "endDate": "YYYY-MM-DD",\n' +
      '    "theme": string,\n' +
      '    "topics": [{\n' +
      '      "strand": string,\n' +
      '      "learningOutcome": string,\n' +
      '      "title": string,\n' +
      '      "rationale": string,\n' +
      '      "hours": number,\n' +
      '      "practiceHint": string,\n' +
      '      "relatedIncorrectItems"?: [{ "questionText": string, "chosenAnswer": string, "correctAnswer": string, "trap": string }]\n' +
      '    }],\n' +
      '    "milestone": string\n' +
      '  }],\n' +
      '  "summary": string,\n' +
      '  "caveats": string[]\n' +
      '}';
    const fullPrompt = prompt + jsonInstruction;
    // PostHog $ai_generation tracing — only when caller passed identity.
    // Avoids capturing telemetry under a synthetic distinctId for offline /
    // CLI invocations of this agent.
    const message = tracing
      ? await traceLLM(llm, fullPrompt, {
          distinctId: tracing.distinctId,
          traceId: tracing.traceId,
          spanName: 'study_plan_generate',
          provider: 'openrouter',
          model: process.env.OPENROUTER_MODEL ?? 'anthropic/claude-haiku-4.5',
          properties: {
            total_weeks: totalWeeks,
            goal_tier: input.goalTier,
            weekly_hours: input.weeklyHours,
          },
        })
      : await llm.invoke(fullPrompt);
    const raw = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);
    const parsed = JSON.parse(stripJsonFences(raw));
    const normalized = normalizeLLMPlan(parsed, priorities);
    llmPlan = PlanSchema.parse(normalized);
  } catch (err) {
    // Fallback: deterministic skeleton plan if the LLM is unreachable
    // or its output fails schema validation. Better than blocking
    // the user behind a flaky network.
    console.warn(
      `[study-plan] LLM unavailable, returning skeleton plan: ${err instanceof Error ? err.message : String(err)}`,
    );
    llmPlan = skeletonPlan(priorities, input, totalWeeks, startIso);
  }

  // Re-derive each week's [start, end] so the LLM cannot drift dates.
  const weeks = llmPlan.weeks.map((w) => {
    const range = weekRange(startIso, w.weekNumber);
    return { ...w, startDate: range.start, endDate: range.end };
  });

  const totalHours = weeks.reduce(
    (acc, w) => acc + w.topics.reduce((a, t) => a + t.hours, 0),
    0,
  );

  return {
    input,
    totalWeeks,
    totalHours: Math.round(totalHours * 10) / 10,
    priorities,
    weeks,
    summary: llmPlan.summary,
    caveats: llmPlan.caveats,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic fallback plan when the LLM is unreachable. Distributes the
 * weekly budget proportional to gap (gap=2 → 50%, gap=1 → 30%, gap=0 → 20%).
 */
function skeletonPlan(
  priorities: StrandPriority[],
  input: StudyPlanInput,
  totalWeeks: number,
  startIso: string,
): LLMPlan {
  const weeks: LLMPlan['weeks'] = [];
  const totalGap = priorities.reduce((acc, p) => acc + (p.gap || 1), 0) || 1;
  for (let i = 1; i <= totalWeeks; i += 1) {
    const range = weekRange(startIso, i);
    const topics = priorities
      .filter((p) => p.gap > 0 || priorities.length === 1)
      .slice(0, 3)
      .map((p) => ({
        strand: p.strand,
        learningOutcome: `${p.currentTier.toUpperCase()}.${(p.strand.split('_')[0] ?? p.strand).toUpperCase()}.MIX`,
        title: `${strandLabel(p.strand)} — bridge ${p.currentTier} to ${p.goalTier}`,
        rationale: p.focus,
        hours: Math.max(0.5, Math.round(((p.gap || 1) / totalGap) * input.weeklyHours * 10) / 10),
        practiceHint:
          'Khan Academy topic + 1 past-paper question per session; check answers immediately.',
      }));
    weeks.push({
      weekNumber: i,
      startDate: range.start,
      endDate: range.end,
      theme: i === totalWeeks ? 'Mock paper + revision' : `Week ${i} — focused practice`,
      topics,
      milestone:
        i === totalWeeks
          ? 'Complete one timed full mock paper.'
          : 'Hit 80% accuracy on this week\u2019s focused practice set.',
    });
  }
  return {
    weeks,
    summary:
      `A ${totalWeeks}-week plan toward ${input.goalTier} tier. Generated offline because the LLM` +
      ' coach was unavailable; revisit and click Regenerate when the network recovers.',
    caveats: ['Generated as a deterministic fallback — quality lower than the LLM-curated plan.'],
  };
}
