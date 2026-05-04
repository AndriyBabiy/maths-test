/**
 * OpenRouter-configured ChatOpenAI factory.
 *
 * The OpenAI-compatible API at https://openrouter.ai/api/v1 lets us use
 * `@langchain/openai`'s `ChatOpenAI` wrapper with arbitrary OpenRouter
 * model slugs (e.g. `anthropic/claude-sonnet-4-6`). Temperature is low
 * (0.3) because the only LLM job here is friendly one-line commentary
 * — we want consistent, on-tone output, not creative variance.
 */
import { ChatOpenAI } from '@langchain/openai';

export function createLLM(): ChatOpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-haiku-4.5';
  return new ChatOpenAI({
    apiKey,
    model,
    configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    temperature: 0.3,
  });
}
