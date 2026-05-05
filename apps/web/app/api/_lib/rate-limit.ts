/**
 * In-memory token-bucket rate limiter, keyed on an arbitrary string (typically
 * the client IP). Single-instance only — fine for our single-replica Hetzner
 * deploy; a Redis-backed bucket would be the swap-in for horizontal scale.
 *
 * Buckets refill linearly: at any time, `tokens = min(capacity, stored + (Δt /
 * windowMs) × capacity)`. A request consumes one token; if the bucket is empty
 * the request is rejected with the seconds the caller should wait before
 * retrying.
 */
import type { NextRequest } from 'next/server';

export interface RateLimitConfig {
  /** Max bursts allowed in the window. */
  capacity: number;
  /** Window length in milliseconds (e.g. 60_000 for "per minute"). */
  windowMs: number;
}

interface Bucket {
  tokens: number;
  /** Timestamp (ms) of the last refill calculation. */
  updatedAt: number;
}

/** Module-level Map; survives within a single Node process for the route's lifetime. */
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds to wait before retrying (only meaningful when !allowed). */
  retryAfter: number;
  /** Current remaining tokens after this attempt (may be 0). */
  remaining: number;
}

/**
 * Try to consume one token from the bucket identified by `key`. Returns
 * whether the request is allowed and, if not, how long to wait.
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: config.capacity, updatedAt: now };

  // Refill: tokens added since last check, capped at capacity.
  const elapsed = now - bucket.updatedAt;
  const refill = (elapsed / config.windowMs) * config.capacity;
  const refilled = Math.min(config.capacity, bucket.tokens + refill);

  if (refilled < 1) {
    // Not enough for one request — figure out how long until a single token regenerates.
    const tokensNeeded = 1 - refilled;
    const retryAfter = Math.ceil((tokensNeeded / config.capacity) * (config.windowMs / 1000));
    buckets.set(key, { tokens: refilled, updatedAt: now });
    return { allowed: false, retryAfter, remaining: 0 };
  }

  const remaining = refilled - 1;
  buckets.set(key, { tokens: remaining, updatedAt: now });
  return { allowed: true, retryAfter: 0, remaining: Math.floor(remaining) };
}

/**
 * Pull the client IP from the request. Behind nginx, X-Forwarded-For is the
 * source of truth (the first value is the original client). `request.ip` is
 * undefined on Node runtime in many setups, so we don't rely on it.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
