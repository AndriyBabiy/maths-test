/**
 * Diagnostic assessment HTTP route.
 *
 * Calls the LangGraph agent at `./_agent/` (LangGraph + OpenRouter, all
 * in-process). The Rasch math runs directly against `@maths-diag/core` and
 * the LLM is only responsible for short learner-facing commentary.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '../_lib/rate-limit';
import type {
  AssessmentRequest,
  AssessmentResponse,
  Item,
  PublicItem,
} from './types';
import {
  answerAssessment,
  finaliseAssessment,
  startAssessment,
} from './_agent';

export const dynamic = 'force-dynamic';

const ITEMS_CAP = 20;

/**
 * 60 requests/minute/IP — comfortable for one student (start + ~20 answers +
 * finalise = 22 calls per session) while still cutting off scripted floods.
 */
const ASSESSMENT_LIMIT = { capacity: 60, windowMs: 60_000 };

/** Hand-rolled validator. Avoids a `zod` dependency in this route file. */
function parseAssessmentRequest(
  raw: unknown,
): { ok: true; value: AssessmentRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'body must be an object' };
  }
  const r = raw as Record<string, unknown>;
  const sessionId = typeof r.sessionId === 'string' ? r.sessionId : '';
  if (!sessionId) return { ok: false, error: 'sessionId required' };

  if (r.kind === 'start') {
    return { ok: true, value: { kind: 'start', sessionId } };
  }
  if (r.kind === 'finalise') {
    return { ok: true, value: { kind: 'finalise', sessionId } };
  }
  if (r.kind === 'answer') {
    const itemId = typeof r.itemId === 'string' ? r.itemId : '';
    if (!itemId) return { ok: false, error: 'itemId required' };
    const chosenIndex = r.chosenIndex;
    if (chosenIndex !== 0 && chosenIndex !== 1 && chosenIndex !== 2 && chosenIndex !== 3) {
      return { ok: false, error: 'chosenIndex must be 0|1|2|3' };
    }
    const latencyMs = r.latencyMs;
    if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs) || latencyMs < 0) {
      return { ok: false, error: 'latencyMs must be a non-negative number' };
    }
    return {
      ok: true,
      value: { kind: 'answer', sessionId, itemId, chosenIndex, latencyMs },
    };
  }
  return { ok: false, error: `unknown kind: ${String(r.kind)}` };
}

function toPublicItem(item: Item): PublicItem {
  // Drop correctIndex; everything else passes through to the UI.
  const { correctIndex: _drop, ...publicItem } = item;
  void _drop;
  return publicItem as PublicItem;
}

function errorResponse(message: string, status = 500): Response {
  return NextResponse.json<AssessmentResponse>(
    { kind: 'error', message },
    { status },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  // Rate limit early so floods of malformed bodies still get shed.
  const ip = clientIp(req);
  const limit = rateLimit(`assessment:${ip}`, ASSESSMENT_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json<AssessmentResponse>(
      {
        kind: 'error',
        message: `Too many requests — try again in ${limit.retryAfter}s.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfter) },
      },
    );
  }

  let body: AssessmentRequest;
  try {
    const raw: unknown = await req.json();
    const parsed = parseAssessmentRequest(raw);
    if (!parsed.ok) {
      return errorResponse(`Invalid request body: ${parsed.error}`, 400);
    }
    body = parsed.value;
  } catch {
    return errorResponse('Request body is not valid JSON.', 400);
  }

  try {
    if (body.kind === 'start') {
      const { item, asked, commentary } = await startAssessment(body.sessionId);
      return NextResponse.json<AssessmentResponse>({
        kind: 'next_item',
        item: toPublicItem(item),
        progress: { asked, cap: ITEMS_CAP, commentary, lastCorrect: null },
      });
    }

    if (body.kind === 'answer') {
      const result = await answerAssessment(body);
      if (result.kind === 'next_item') {
        return NextResponse.json<AssessmentResponse>({
          kind: 'next_item',
          item: toPublicItem(result.item),
          progress: {
            asked: result.asked,
            cap: ITEMS_CAP,
            commentary: result.commentary,
            lastCorrect: result.lastCorrect,
          },
        });
      }
      return NextResponse.json<AssessmentResponse>({
        kind: 'report',
        report: result.report,
        commentary: result.commentary,
        lastCorrect: result.lastCorrect,
      });
    }

    // body.kind === 'finalise'
    const { report, commentary } = await finaliseAssessment(body.sessionId);
    return NextResponse.json<AssessmentResponse>({
      kind: 'report',
      report,
      commentary,
      lastCorrect: null,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error';
    console.error('[assessment] handler error', detail);
    return errorResponse(`Assessment agent failed: ${detail}`, 502);
  }
}
