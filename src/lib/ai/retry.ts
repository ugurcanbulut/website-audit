// Generic retry-with-timeout wrapper for AI provider calls.
//
// Provider SDK errors that are safe to retry: 429 (rate limit), 5xx, network
// timeouts, aborted requests. 4xx other than 429 are considered permanent and
// rethrown immediately so we do not mask schema / API-key errors.

export interface RetryOptions {
  /** Number of attempts including the first. Defaults to 3. */
  attempts?: number;
  /** Delay sequence in ms. Index beyond end repeats the last value. */
  delaysMs?: number[];
  /** Per-attempt timeout in ms. Defaults to 60_000. */
  timeoutMs?: number;
  /** Optional tag for error messages. */
  label?: string;
}

const DEFAULT_DELAYS = [2_000, 8_000, 30_000];

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as {
    status?: number;
    statusCode?: number;
    code?: string | number;
    name?: string;
    message?: string;
  };
  const status = anyErr.status ?? anyErr.statusCode;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (anyErr.name === "AbortError") return true;
  if (
    typeof anyErr.code === "string" &&
    ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN"].includes(
      anyErr.code,
    )
  ) {
    return true;
  }
  if (typeof anyErr.message === "string") {
    if (/timeout|rate[-_ ]?limit|overloaded/i.test(anyErr.message)) return true;
  }
  return false;
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function withRetryAndTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delays = options.delaysMs ?? DEFAULT_DELAYS;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const label = options.label ?? "ai-call";

  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await withTimeout(fn, timeoutMs, label);
    } catch (err) {
      lastErr = err;
      const retryable = isRetryable(err);
      const isFinalAttempt = attempt === attempts - 1;
      if (!retryable || isFinalAttempt) throw err;
      const wait = delays[Math.min(attempt, delays.length - 1)];
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  // Unreachable — the loop either returns or throws.
  throw lastErr;
}
