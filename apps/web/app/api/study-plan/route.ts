/**
 * POST /api/study-plan
 *
 * Body: { report: AssessmentReport, input: StudyPlanInput }
 * Returns: { plan: StudyPlan }
 *
 * Stateless — does not persist anything. The frontend already holds the
 * assessment report; we just hydrate it back through the LLM agent.
 */
import { type NextRequest, NextResponse } from 'next/server';
import type { AssessmentReport, StudyPlanInput } from '@maths-diag/core';
import { buildStudyPlan } from './_agent';

export const dynamic = 'force-dynamic';

const VALID_TIERS = new Set(['foundation', 'ordinary', 'higher']);
const VALID_STRANDS = new Set([
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
  'measures_data',
]);

interface ParsedBody {
  report: AssessmentReport;
  input: StudyPlanInput;
}

function parseBody(raw: unknown): { ok: true; value: ParsedBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'body must be an object' };
  const r = raw as Record<string, unknown>;
  if (!r.report || typeof r.report !== 'object') {
    return { ok: false, error: 'report required' };
  }
  if (!r.input || typeof r.input !== 'object') {
    return { ok: false, error: 'input required' };
  }
  const input = r.input as Record<string, unknown>;
  if (typeof input.goalTier !== 'string' || !VALID_TIERS.has(input.goalTier)) {
    return { ok: false, error: 'input.goalTier must be foundation|ordinary|higher' };
  }
  if (typeof input.targetDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) {
    return { ok: false, error: 'input.targetDate must be YYYY-MM-DD' };
  }
  const target = new Date(input.targetDate);
  if (Number.isNaN(target.getTime())) {
    return { ok: false, error: 'input.targetDate is not a valid date' };
  }
  if (target.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return { ok: false, error: 'input.targetDate must be in the future' };
  }
  if (typeof input.weeklyHours !== 'number' || !Number.isFinite(input.weeklyHours)) {
    return { ok: false, error: 'input.weeklyHours must be a number' };
  }
  if (input.weeklyHours < 1 || input.weeklyHours > 40) {
    return { ok: false, error: 'input.weeklyHours must be between 1 and 40' };
  }
  const focusStrandsRaw = Array.isArray(input.focusStrands) ? input.focusStrands : [];
  const focusStrands = focusStrandsRaw.filter(
    (s): s is StudyPlanInput['focusStrands'][number] =>
      typeof s === 'string' && VALID_STRANDS.has(s),
  );
  const learnerName =
    typeof input.learnerName === 'string' && input.learnerName.length <= 80
      ? input.learnerName
      : undefined;
  const notes =
    typeof input.notes === 'string' && input.notes.length <= 500 ? input.notes : undefined;

  return {
    ok: true,
    value: {
      report: r.report as AssessmentReport,
      input: {
        learnerName,
        goalTier: input.goalTier as StudyPlanInput['goalTier'],
        targetDate: input.targetDate,
        weeklyHours: input.weeklyHours,
        focusStrands,
        notes,
      },
    },
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = parseBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const plan = await buildStudyPlan(parsed.value.report, parsed.value.input);
    return NextResponse.json({ plan });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[study-plan] generation failed:', detail);
    return NextResponse.json(
      { error: 'study plan generation failed', detail },
      { status: 500 },
    );
  }
}
