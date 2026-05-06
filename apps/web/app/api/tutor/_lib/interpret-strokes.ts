/**
 * Lite-model scratchpad interpreter.
 *
 * The main tutor LLM is text-only (cheap, fast). To let it coach against the
 * student's actual working, we run a *separate* vision-capable model upstream
 * — by default `google/gemini-2.5-flash-lite` (~$0.10 / Mtok in, $0.40 / Mtok
 * out). It produces a 1–2 sentence transcription of the canvas which the
 * tutor route then inlines into the main prompt. The main tutor never sees
 * the raw image, so its model can stay pinned.
 *
 * Failure mode: every error path returns `null` and the route handler omits
 * the scratchpad block from the main prompt. The student gets a normal reply,
 * just without canvas-aware coaching for that turn.
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { AIMessageChunk } from '@langchain/core/messages';
import { traceLLM } from '../../_lib/llm-trace';

const SYSTEM_PROMPT = [
  'You read student maths working from a scratchpad image.',
  'In one or two sentences, describe what they have written: equations, expressions, partial steps. Quote the maths verbatim where you can.',
  'Do NOT judge correctness. Do NOT give hints. Do NOT mention that you are an AI.',
  'If the image is blank, illegible, or you cannot read anything, reply exactly: (blank)',
].join(' ');

const USER_PROMPT =
  'Describe the maths working in this scratchpad image. Reply in 1-2 sentences.';

const PNG_PREFIX = 'data:image/png;base64,';
const MAX_PAYLOAD_BYTES = 1_400_000;
const MAX_INTERPRETATION_CHARS = 600;

export interface InterpretStrokesArgs {
  pngDataUrl: string;
  sessionId: string;
  distinctId: string;
}

export async function interpretStrokes(
  args: InterpretStrokesArgs,
): Promise<string | null> {
  const { pngDataUrl, sessionId, distinctId } = args;
  if (!pngDataUrl.startsWith(PNG_PREFIX)) return null;
  if (pngDataUrl.length > MAX_PAYLOAD_BYTES) return null;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const model =
    process.env.OPENROUTER_INTERPRETER_MODEL ?? 'google/gemini-2.5-flash-lite';

  try {
    const llm = new ChatOpenAI({
      apiKey,
      model,
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      temperature: 0,
      maxTokens: 200,
    });

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage({
        content: [
          { type: 'image_url', image_url: { url: pngDataUrl } },
          { type: 'text', text: USER_PROMPT },
        ],
      }),
    ];

    const out = await traceLLM(llm, messages, {
      distinctId,
      traceId: sessionId,
      spanName: 'tutor_scratchpad_interpretation',
      provider: 'openrouter',
      model,
      properties: { assessment_session_id: sessionId },
    });

    const text = extractText(out);
    if (!text) return null;
    return text.length > MAX_INTERPRETATION_CHARS
      ? text.slice(0, MAX_INTERPRETATION_CHARS)
      : text;
  } catch (err) {
    console.warn('[tutor] interpret-strokes failed:', err);
    return null;
  }
}

function extractText(message: AIMessageChunk): string {
  const c = message.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) {
    return c
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) {
          const t = (block as { text?: unknown }).text;
          return typeof t === 'string' ? t : '';
        }
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}
