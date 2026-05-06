/**
 * Server-side PostHog singleton + helpers.
 *
 * One client per Node process. PostHog batches events internally; we don't
 * await `capture()` on the request hot-path. The container is long-running
 * (not serverless), so default flush cadence is fine — but we still register
 * a `SIGTERM` handler that calls `shutdown()` to drain pending events on a
 * graceful redeploy, so we don't lose the last few seconds of telemetry.
 *
 * If `POSTHOG_API_KEY` is unset (e.g. local dev without analytics), the
 * helper returns `null` and every callsite no-ops. This lets the LLM and
 * route code stay analytics-agnostic — telemetry is supplementary, never
 * load-bearing.
 */
import { PostHog } from 'posthog-node';

let client: PostHog | null | undefined;

export function getPostHog(): PostHog | null {
  if (client !== undefined) return client;
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    client = null;
    return null;
  }
  const host = process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com';
  client = new PostHog(apiKey, {
    host,
    flushAt: 20,
    flushInterval: 10_000,
  });

  if (typeof process !== 'undefined') {
    const drain = async () => {
      try {
        await client?.shutdown();
      } catch {
        // shutdown is best-effort; never throw from the signal handler.
      }
    };
    process.once('SIGTERM', drain);
    process.once('SIGINT', drain);
    process.once('beforeExit', drain);
  }

  return client;
}

/**
 * Fire-and-forget capture. Errors swallowed — analytics must never break a
 * user-facing request. `distinctId` is required so events are attributed to
 * a person (or, for anonymous flows, the maths-test sessionId).
 */
export function capture(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties,
    });
  } catch {
    // ignore
  }
}
