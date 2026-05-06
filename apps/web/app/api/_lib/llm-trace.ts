/**
 * Wraps an LLM `.invoke()` call, times it, and emits a `$ai_generation`
 * event to PostHog. Token counts come from `usage_metadata` on the raw
 * `AIMessage` — but we operate at the `withStructuredOutput()` boundary
 * where the parsed object is what's returned, so we attach a callback
 * handler that snapshots the raw response.
 *
 * Caller passes:
 *   - the runnable (already configured with structured output if applicable)
 *   - the prompt
 *   - identity (`distinctId`) + correlation (`traceId`) + product props
 *
 * Errors from the LLM are re-thrown after capturing a `$ai_generation`
 * event with `$ai_is_error: true`. PostHog capture itself is best-effort
 * and never throws.
 */
import type { BaseMessage } from '@langchain/core/messages';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { LLMResult } from '@langchain/core/outputs';
import { capture } from './posthog-server';

interface UsageSnapshot {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
}

class UsageCaptureHandler extends BaseCallbackHandler {
  name = 'usage-capture';
  usage: UsageSnapshot = {};

  override async handleLLMEnd(output: LLMResult): Promise<void> {
    const llmOutput = output.llmOutput as
      | { tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }
      | undefined;
    if (llmOutput?.tokenUsage) {
      this.usage.inputTokens = llmOutput.tokenUsage.promptTokens;
      this.usage.outputTokens = llmOutput.tokenUsage.completionTokens;
      this.usage.totalTokens = llmOutput.tokenUsage.totalTokens;
    }
    const firstGen = output.generations?.[0]?.[0] as
      | { message?: BaseMessage; generationInfo?: { model_name?: string } }
      | undefined;
    if (firstGen?.generationInfo?.model_name) {
      this.usage.model = firstGen.generationInfo.model_name;
    }
    const message = firstGen?.message as
      | { usage_metadata?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } }
      | undefined;
    const meta = message?.usage_metadata;
    if (meta) {
      if (typeof meta.input_tokens === 'number') this.usage.inputTokens = meta.input_tokens;
      if (typeof meta.output_tokens === 'number') this.usage.outputTokens = meta.output_tokens;
      if (typeof meta.total_tokens === 'number') this.usage.totalTokens = meta.total_tokens;
    }
  }
}

export interface TraceLLMOptions {
  /** PostHog distinctId for this user/session. */
  distinctId: string;
  /** Correlation ID across multiple LLM calls within one user action. */
  traceId?: string;
  /** Logical span name — e.g. `tutor_reply`, `assessment_narrate`. */
  spanName: string;
  /** Provider slug (e.g. 'openrouter', 'openai', 'anthropic'). */
  provider?: string;
  /** Stable model slug — useful when `usage_metadata` doesn't echo it back. */
  model?: string;
  /** Extra product properties to attach. */
  properties?: Record<string, unknown>;
}

interface InvokableRunnable<TPrompt, TOutput> {
  invoke(prompt: TPrompt, config?: { callbacks?: BaseCallbackHandler[] }): Promise<TOutput>;
}

export async function traceLLM<TPrompt, TOutput>(
  runnable: InvokableRunnable<TPrompt, TOutput>,
  prompt: TPrompt,
  opts: TraceLLMOptions,
): Promise<TOutput> {
  const handler = new UsageCaptureHandler();
  const start = Date.now();
  try {
    const out = await runnable.invoke(prompt, { callbacks: [handler] });
    const latencySec = (Date.now() - start) / 1000;
    capture({
      distinctId: opts.distinctId,
      event: '$ai_generation',
      properties: {
        $ai_trace_id: opts.traceId,
        $ai_span_name: opts.spanName,
        $ai_provider: opts.provider ?? 'openrouter',
        $ai_model: handler.usage.model ?? opts.model,
        $ai_input_tokens: handler.usage.inputTokens,
        $ai_output_tokens: handler.usage.outputTokens,
        $ai_total_tokens: handler.usage.totalTokens,
        $ai_latency: latencySec,
        $ai_is_error: false,
        ...opts.properties,
      },
    });
    return out;
  } catch (err) {
    const latencySec = (Date.now() - start) / 1000;
    capture({
      distinctId: opts.distinctId,
      event: '$ai_generation',
      properties: {
        $ai_trace_id: opts.traceId,
        $ai_span_name: opts.spanName,
        $ai_provider: opts.provider ?? 'openrouter',
        $ai_model: handler.usage.model ?? opts.model,
        $ai_latency: latencySec,
        $ai_is_error: true,
        $ai_error: err instanceof Error ? err.message : String(err),
        ...opts.properties,
      },
    });
    throw err;
  }
}
