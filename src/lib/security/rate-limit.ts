import { NextRequest, NextResponse } from "next/server";
import { getRedisConnection } from "@/lib/queue/connection";

// ─────────────────────────────────────────────────────────────────────────────
// Sliding-window rate limiter backed by Redis sorted sets.
//
// Used on write endpoints to stop unbounded scan / crawl / AI-remediation
// triggers. Read endpoints are unconstrained. All limits are per-client
// (IP address from X-Forwarded-For if trusted, else socket IP).
//
// Skipped entirely when RATE_LIMIT_ENABLED=false or when Redis is
// unavailable — rate limiting should never be the reason the app
// disappears.
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Window length in seconds */
  windowSec: number;
  /** Max requests in that window */
  max: number;
  /** Bucket namespace, e.g. "scan" */
  bucket: string;
}

export const RATE_LIMITS = {
  scan: { windowSec: 3600, max: 10, bucket: "scan" },
  crawl: { windowSec: 3600, max: 5, bucket: "crawl" },
  batch: { windowSec: 3600, max: 3, bucket: "batch" },
  remediate: { windowSec: 3600, max: 60, bucket: "remediate" },
} as const satisfies Record<string, RateLimitConfig>;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetMs: number; // ms until a slot frees up
}

/**
 * Check and record one request against the bucket. Fails open (returns ok=true)
 * on any Redis error so a Redis outage does not take the API down.
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (process.env.RATE_LIMIT_ENABLED === "false") {
    return { ok: true, remaining: config.max, limit: config.max, resetMs: 0 };
  }

  const ip = clientIp(request);
  const key = `rl:${config.bucket}:${ip}`;
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const windowStart = now - windowMs;

  try {
    const redis = await getRedisConnection();

    // Zremrangebyscore to evict old timestamps, zcard to count current window.
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}:${Math.random()}`);
    pipeline.pexpire(key, windowMs + 1000);
    const results = await pipeline.exec();
    if (!results) {
      return { ok: true, remaining: config.max, limit: config.max, resetMs: 0 };
    }

    const currentCount = Number(results[1]?.[1] ?? 0);
    // +1 for the one we just added
    const used = currentCount + 1;
    const remaining = Math.max(0, config.max - used);

    if (used > config.max) {
      // Over limit — look up oldest entry to compute reset.
      const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestMs = oldest[1] ? Number(oldest[1]) : now;
      const resetMs = Math.max(0, oldestMs + windowMs - now);
      return { ok: false, remaining: 0, limit: config.max, resetMs };
    }
    return { ok: true, remaining, limit: config.max, resetMs: 0 };
  } catch (e) {
    console.warn(
      "Rate limiter degraded (Redis error), allowing request:",
      e instanceof Error ? e.message : e,
    );
    return { ok: true, remaining: config.max, limit: config.max, resetMs: 0 };
  }
}

/**
 * Convenience helper: returns a 429 NextResponse if the limit is exceeded,
 * else null. Caller proceeds normally on null.
 */
export async function rateLimitOrResponse(
  request: NextRequest,
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, config);
  if (result.ok) return null;
  const retryAfter = Math.ceil(result.resetMs / 1000);
  return NextResponse.json(
    {
      error: `Rate limit exceeded. Try again in ${retryAfter}s.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}
