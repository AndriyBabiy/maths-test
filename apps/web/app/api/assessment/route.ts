import { type NextRequest, NextResponse } from 'next/server';
import type {
  AssessmentRequest,
  AssessmentResponse,
  AssessmentReport,
  Item,
  PublicItem,
} from './types';

// =============================================================================
// Lua client — POST /chat/generate/{agentId}?channel=...
// -----------------------------------------------------------------------------
// Discovered surface (from `lua-cli` v3.13.0, see
// `apps/lua-agent/node_modules/lua-cli/dist/api/chat.api.service.js` and
// `dist/config/constants.js`):
//
//   POST {LUA_API_URL}/chat/generate/{agentId}?channel=dev
//   Authorization: Bearer {LUA_API_KEY}
//   Content-Type: application/json
//   Body: {
//     messages: [{ type: 'text', text: '...' }],
//     navigate: true,
//     skillOverride: [],
//     preprocessorOverride: [],
//     postprocessorOverride: [],
//     threadId?: string,
//     systemPrompt?: string,
//   }
//
// Production response (the simple `ChatResponse` shape, NOT the dev-only
// `DetailedChatResponse`) only exposes `text`. Tool calls and tool results are
// NOT surfaced to API consumers. So the contract is: prompt the agent to emit
// a structured JSON envelope embedded in its text reply, and parse that here.
// =============================================================================

const LUA_BASE_URL = process.env.LUA_API_URL ?? 'https://api.heylua.ai';
const LUA_CHANNEL = process.env.LUA_CHANNEL ?? 'dev';
const ITEMS_CAP = 15;

/** Hand-rolled validator. Avoids a `zod` dependency in `apps/web`. */
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

interface LuaChatBody {
  messages: Array<{ type: 'text'; text: string }>;
  navigate: boolean;
  skillOverride: unknown[];
  preprocessorOverride: unknown[];
  postprocessorOverride: unknown[];
  threadId?: string;
  systemPrompt?: string;
}

/** Loose shape of the production chat response — handles both wrapped
 * (`{success, data: {text}}`) and unwrapped (`{success, text}`) variants. */
interface LuaChatResponse {
  success?: boolean;
  text?: string;
  error?: string | { message?: string };
  data?: { text?: string };
}

async function callLuaAgent(args: {
  agentId: string;
  apiKey: string;
  message: string;
  threadId: string;
  systemPrompt?: string;
}): Promise<{ text: string }> {
  const url = `${LUA_BASE_URL}/chat/generate/${encodeURIComponent(
    args.agentId,
  )}?channel=${encodeURIComponent(LUA_CHANNEL)}`;

  const body: LuaChatBody = {
    messages: [{ type: 'text', text: args.message }],
    navigate: true,
    skillOverride: [],
    preprocessorOverride: [],
    postprocessorOverride: [],
    threadId: args.threadId,
    ...(args.systemPrompt ? { systemPrompt: args.systemPrompt } : {}),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    // 90s — agent may run several tool calls per turn.
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const errBody = (await res.json()) as { message?: string; error?: string };
      detail = errBody.message ?? errBody.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`Lua chat error: ${detail}`);
  }

  const json = (await res.json()) as LuaChatResponse;

  // Two possible shapes — be permissive.
  const text = json.text ?? json.data?.text ?? '';
  if (typeof text !== 'string' || text.length === 0) {
    const errStr =
      typeof json.error === 'string'
        ? json.error
        : json.error?.message ?? 'Empty response from Lua agent';
    throw new Error(`Lua chat error: ${errStr}`);
  }

  return { text };
}

// =============================================================================
// JSON envelope — instruct the agent to embed structured data in its reply,
// fenced inside <lua-out>...</lua-out>. We parse the LAST occurrence (in case
// the agent shows multiple drafts).
// =============================================================================

const ENVELOPE_OPEN = '<lua-out>';
const ENVELOPE_CLOSE = '</lua-out>';

interface EnvelopeNextItem {
  kind: 'next_item';
  asked: number;
  item: Item;
}

interface EnvelopeReport {
  kind: 'report';
  report: AssessmentReport;
}

type Envelope = EnvelopeNextItem | EnvelopeReport;

function extractEnvelope(text: string): Envelope | null {
  const lastOpen = text.lastIndexOf(ENVELOPE_OPEN);
  if (lastOpen === -1) return null;
  const lastClose = text.indexOf(ENVELOPE_CLOSE, lastOpen);
  if (lastClose === -1) return null;
  const inner = text.slice(lastOpen + ENVELOPE_OPEN.length, lastClose).trim();
  try {
    const parsed = JSON.parse(inner) as Envelope;
    if (parsed && typeof parsed === 'object' && 'kind' in parsed) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Strip the envelope so the user-facing commentary doesn't leak machine markup. */
function stripEnvelope(text: string): string {
  const open = text.indexOf(ENVELOPE_OPEN);
  if (open === -1) return text.trim();
  const close = text.indexOf(ENVELOPE_CLOSE, open);
  const before = text.slice(0, open);
  const after = close === -1 ? '' : text.slice(close + ENVELOPE_CLOSE.length);
  return (before + after).trim();
}

function toPublicItem(item: Item): PublicItem {
  // Drop correctIndex; everything else passes through.
  const { correctIndex: _drop, ...publicItem } = item;
  void _drop;
  return publicItem as PublicItem;
}

// =============================================================================
// Per-turn user prompts. The deployed agent's system prompt (in
// `apps/lua-agent/src/index.ts`) tells it WHEN to call which tool. Here we
// add the ENVELOPE contract — the agent must echo the latest tool result as
// JSON inside <lua-out>...</lua-out> so this route can shape a typed response
// for the UI.
// =============================================================================

const ENVELOPE_CONTRACT = `
After running your tools, append a single machine-readable envelope to the END of your reply.
Format exactly:

<lua-out>{"kind":"next_item","asked":<number>,"item":<the full Item object returned by pick_next_item or generate_item>}</lua-out>

— or, when the assessment is complete:

<lua-out>{"kind":"report","report":<the full AssessmentReport returned by finalise_assessment>}</lua-out>

The envelope must be a single self-contained JSON object on one line. Do NOT include the envelope in any other location. Do NOT wrap it in code fences. Everything before the envelope is your normal natural-language commentary for the learner.`.trim();

function startMessage(sessionId: string): string {
  return `
Begin a new diagnostic assessment for sessionId="${sessionId}".

Steps:
1. Call get_session_state with sessionId="${sessionId}" to initialise.
2. Run detect_stage to probe the learner's stage if needed, OR pick a sensible warmup item.
3. Call pick_next_item (or generate_item if the bank is sparse) and obtain the next Item.

Then reply with one short encouraging sentence of commentary, and append the <lua-out> envelope describing the chosen item. Set "asked" to the number of items asked so far (after this pick, this should be 1).

${ENVELOPE_CONTRACT}
`.trim();
}

function answerMessage(args: {
  sessionId: string;
  itemId: string;
  chosenIndex: 0 | 1 | 2 | 3;
  latencyMs: number;
}): string {
  return `
The learner just answered an item.

Steps:
1. Call score_answer with sessionId="${args.sessionId}", itemId="${args.itemId}", chosenIndex=${args.chosenIndex}, latencyMs=${args.latencyMs}.
2. Inspect the recommendation:
   - If 'finalise' OR ${ITEMS_CAP} items have been asked, call finalise_assessment and emit the report envelope.
   - Otherwise call get_session_state, pick the strand with highest SE (respecting curriculum coverage), and call pick_next_item (or generate_item).
3. In all cases, reply with ONE sentence of commentary (e.g. "Algebra looks solid; switching to Trigonometry.") and append the <lua-out> envelope.

${ENVELOPE_CONTRACT}
`.trim();
}

function finaliseMessage(sessionId: string): string {
  return `
End the assessment for sessionId="${sessionId}" now.

Call finalise_assessment with sessionId="${sessionId}" and emit the report envelope. Reply with one short congratulatory sentence and the <lua-out> envelope (kind:"report").

${ENVELOPE_CONTRACT}
`.trim();
}

// =============================================================================
// Route handler.
// =============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  const agentId = process.env.LUA_AGENT_ID;
  const apiKey = process.env.LUA_API_KEY;

  if (!agentId || !apiKey) {
    return NextResponse.json<AssessmentResponse>(
      {
        kind: 'error',
        message:
          'Lua agent not configured. Set LUA_AGENT_ID and LUA_API_KEY in apps/web/.env.local after `lua deploy`.',
      },
      { status: 503 },
    );
  }

  let body: AssessmentRequest;
  try {
    const raw: unknown = await req.json();
    const parsed = parseAssessmentRequest(raw);
    if (!parsed.ok) {
      return NextResponse.json<AssessmentResponse>(
        { kind: 'error', message: `Invalid request body: ${parsed.error}` },
        { status: 400 },
      );
    }
    body = parsed.value;
  } catch {
    return NextResponse.json<AssessmentResponse>(
      { kind: 'error', message: 'Request body is not valid JSON.' },
      { status: 400 },
    );
  }

  let message: string;
  switch (body.kind) {
    case 'start':
      message = startMessage(body.sessionId);
      break;
    case 'answer':
      message = answerMessage(body);
      break;
    case 'finalise':
      message = finaliseMessage(body.sessionId);
      break;
  }

  let agentText: string;
  try {
    const result = await callLuaAgent({
      agentId,
      apiKey,
      message,
      // Use the sessionId as the threadId so Lua scopes conversation state.
      threadId: body.sessionId,
    });
    agentText = result.text;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json<AssessmentResponse>(
      { kind: 'error', message: `Lua call failed: ${detail}` },
      { status: 502 },
    );
  }

  const envelope = extractEnvelope(agentText);
  const commentary = stripEnvelope(agentText);

  // -- Degraded mode: agent didn't return the expected envelope ----------------
  // Surface the natural-language reply so the demo can keep moving while we
  // diagnose. The UI will render this as an error with the agent's own words.
  if (!envelope) {
    return NextResponse.json<AssessmentResponse>(
      {
        kind: 'error',
        message:
          `Agent reply did not contain a <lua-out> envelope. ` +
          `Raw commentary: ${commentary || agentText.slice(0, 500)}`,
      },
      { status: 502 },
    );
  }

  if (envelope.kind === 'next_item') {
    if (!envelope.item || typeof envelope.item !== 'object') {
      return NextResponse.json<AssessmentResponse>(
        { kind: 'error', message: 'Envelope missing `item`.' },
        { status: 502 },
      );
    }
    const publicItem = toPublicItem(envelope.item);
    const asked =
      typeof envelope.asked === 'number' && Number.isFinite(envelope.asked)
        ? envelope.asked
        : 0;
    return NextResponse.json<AssessmentResponse>({
      kind: 'next_item',
      item: publicItem,
      progress: { asked, cap: ITEMS_CAP, commentary },
    });
  }

  if (envelope.kind === 'report') {
    if (!envelope.report || typeof envelope.report !== 'object') {
      return NextResponse.json<AssessmentResponse>(
        { kind: 'error', message: 'Envelope missing `report`.' },
        { status: 502 },
      );
    }
    return NextResponse.json<AssessmentResponse>({
      kind: 'report',
      report: envelope.report,
      commentary,
    });
  }

  return NextResponse.json<AssessmentResponse>(
    { kind: 'error', message: 'Unrecognised envelope kind.' },
    { status: 502 },
  );
}