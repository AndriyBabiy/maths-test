/**
 * LLM tutor chat route. Single OpenRouter call per turn — no streaming, no
 * server-side history (the client posts the recent window). Sits behind an
 * IP-keyed token-bucket rate limiter so a single tab can't pin the LLM.
 *
 * Coaching policy is enforced in the system prompt: the tutor never names the
 * correct option or computes the final answer. That preserves the diagnostic's
 * Rasch ability estimate, which only stays valid if the student actually
 * attempts the question.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLM } from '../assessment/_agent/llm';
import { clientIp, rateLimit } from '../_lib/rate-limit';
import { traceLLM } from '../_lib/llm-trace';
import { capture } from '../_lib/posthog-server';
import type {
  TutorQuestion,
  TutorRequest,
  TutorResponse,
  TutorTurn,
} from './types';

export const dynamic = 'force-dynamic';

/** 30 turns / minute / IP. Generous for one student, tight against scripted abuse. */
const TUTOR_LIMIT = { capacity: 30, windowMs: 60_000 };

/** Cap on chat history we accept — keeps prompt size bounded. */
const HISTORY_MAX = 12;

/** Cap on individual message length so a malicious client can't blow the prompt budget. */
const MESSAGE_MAX_CHARS = 2_000;

const ReplySchema = z.object({
  reply: z.string().min(1).max(700),
});

function isStringQuad(value: unknown): value is [string, string, string, string] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((v) => typeof v === 'string')
  );
}

function parseQuestion(raw: unknown): TutorQuestion | null | { error: string } {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object') {
    return { error: 'question must be an object or null' };
  }
  const q = raw as Record<string, unknown>;
  if (typeof q.text !== 'string' || !q.text) {
    return { error: 'question.text required' };
  }
  if (!isStringQuad(q.choices)) {
    return { error: 'question.choices must be a 4-tuple of strings' };
  }
  if (typeof q.strand !== 'string' || typeof q.learningOutcome !== 'string') {
    return { error: 'question.strand and learningOutcome required' };
  }
  return {
    text: q.text,
    choices: q.choices,
    strand: q.strand,
    learningOutcome: q.learningOutcome,
  };
}

function parseHistory(raw: unknown): TutorTurn[] | { error: string } {
  if (!Array.isArray(raw)) return { error: 'history must be an array' };
  const turns: TutorTurn[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'history entries must be objects' };
    }
    const e = entry as Record<string, unknown>;
    if (e.who !== 'tutor' && e.who !== 'you') {
      return { error: 'history[].who must be "tutor" or "you"' };
    }
    if (typeof e.text !== 'string') {
      return { error: 'history[].text must be a string' };
    }
    turns.push({ who: e.who, text: e.text });
  }
  return turns.slice(-HISTORY_MAX);
}

function parseTutorRequest(
  raw: unknown,
): { ok: true; value: TutorRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'body must be an object' };
  }
  const r = raw as Record<string, unknown>;
  const sessionId = typeof r.sessionId === 'string' ? r.sessionId : '';
  if (!sessionId) return { ok: false, error: 'sessionId required' };

  const distinctId =
    typeof r.distinctId === 'string' && r.distinctId ? r.distinctId : undefined;

  const message = typeof r.message === 'string' ? r.message.trim() : '';
  if (!message) return { ok: false, error: 'message required' };
  if (message.length > MESSAGE_MAX_CHARS) {
    return { ok: false, error: `message exceeds ${MESSAGE_MAX_CHARS} chars` };
  }

  const question = parseQuestion(r.question);
  if (question && typeof question === 'object' && 'error' in question) {
    return { ok: false, error: question.error };
  }

  const history = parseHistory(r.history ?? []);
  if (!Array.isArray(history)) {
    return { ok: false, error: history.error };
  }

  return {
    ok: true,
    value: {
      sessionId,
      distinctId,
      question: question as TutorQuestion | null,
      history,
      message,
    },
  };
}

function buildPrompt(req: TutorRequest): string {
  const lines: string[] = [
    'You are a warm, focused Irish maths tutor coaching a Junior-Cycle student through a multiple-choice diagnostic question.',
    'Coach Socratically: ask what they have tried, name the relevant rule, and suggest one small next step they can try on their scratchpad.',
    'NEVER reveal which option (A/B/C/D) is correct. NEVER compute or state the final numeric answer. If the student asks for the answer, redirect: "Try the next step on the pad and tell me what you get."',
    'Keep replies under 90 words. Use plain prose, not markdown headings or bullet bullets. Wrap any maths in $...$ (e.g. $x^2 + 2x$).',
    'If the student is genuinely stuck, give a progressively deeper hint, but stop short of doing the work for them.',
    'Stay strictly on the active question — refuse off-topic chitchat with one sentence and steer back.',
  ];

  if (req.question) {
    const q = req.question;
    lines.push(
      '',
      `# Active question`,
      `Strand: ${q.strand}`,
      `Learning outcome: ${q.learningOutcome}`,
      `Question: ${q.text}`,
      `Choices:`,
      `  A) ${q.choices[0]}`,
      `  B) ${q.choices[1]}`,
      `  C) ${q.choices[2]}`,
      `  D) ${q.choices[3]}`,
    );
  } else {
    lines.push(
      '',
      `# Active question`,
      `(No question is active yet — gently let the student know the first question is loading and offer a quick warm-up tip.)`,
    );
  }

  if (req.history.length > 0) {
    lines.push('', '# Recent chat (oldest → newest)');
    for (const turn of req.history) {
      const speaker = turn.who === 'tutor' ? 'Tutor' : 'Student';
      lines.push(`${speaker}: ${turn.text}`);
    }
  }

  lines.push('', '# New student message', req.message, '', 'Reply now as the tutor.');
  return lines.join('\n');
}

function jsonResponse(body: TutorResponse, init?: ResponseInit): Response {
  return NextResponse.json<TutorResponse>(body, init);
}

export async function POST(req: NextRequest): Promise<Response> {
  // Rate limit before parsing so a flood of malformed bodies still gets shed.
  const ip = clientIp(req);
  const limit = rateLimit(`tutor:${ip}`, TUTOR_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json<TutorResponse>(
      {
        kind: 'error',
        message: `Too many tutor requests — try again in ${limit.retryAfter}s.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfter) },
      },
    );
  }

  let body: TutorRequest;
  try {
    const raw: unknown = await req.json();
    const parsed = parseTutorRequest(raw);
    if (!parsed.ok) {
      return jsonResponse(
        { kind: 'error', message: `Invalid request body: ${parsed.error}` },
        { status: 400 },
      );
    }
    body = parsed.value;
  } catch {
    return jsonResponse(
      { kind: 'error', message: 'Request body is not valid JSON.' },
      { status: 400 },
    );
  }

  // distinctId from the browser is preferred; fall back to sessionId so
  // events still attach to a stable person — even if PostHog isn't bootstrapped
  // on the client (e.g. ad-blocker), we won't lose server-side telemetry.
  const phDistinctId = body.distinctId ?? body.sessionId;

  capture({
    distinctId: phDistinctId,
    event: 'tutor_message_sent',
    properties: {
      assessment_session_id: body.sessionId,
      message_length: body.message.length,
      has_question: body.question !== null,
      strand: body.question?.strand,
      learning_outcome: body.question?.learningOutcome,
      history_turns: body.history.length,
    },
  });

  try {
    const llm = createLLM().withStructuredOutput(ReplySchema, { name: 'reply' });
    const out = await traceLLM(llm, buildPrompt(body), {
      distinctId: phDistinctId,
      traceId: body.sessionId,
      spanName: 'tutor_reply',
      provider: 'openrouter',
      model: process.env.OPENROUTER_MODEL ?? 'anthropic/claude-haiku-4.5',
      properties: {
        assessment_session_id: body.sessionId,
        strand: body.question?.strand,
        learning_outcome: body.question?.learningOutcome,
      },
    });
    capture({
      distinctId: phDistinctId,
      event: 'tutor_reply_received',
      properties: {
        assessment_session_id: body.sessionId,
        reply_length: out.reply.length,
        strand: body.question?.strand,
      },
    });
    return jsonResponse({ kind: 'reply', text: out.reply });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error';
    console.error('[tutor] LLM call failed', detail);
    capture({
      distinctId: phDistinctId,
      event: 'tutor_reply_failed',
      properties: {
        assessment_session_id: body.sessionId,
        error: detail,
      },
    });
    return jsonResponse(
      {
        kind: 'error',
        message:
          "I'm having trouble reaching the tutor right now — try again in a moment.",
      },
      { status: 502 },
    );
  }
}
