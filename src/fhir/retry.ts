/**
 * Retry helper for transient FHIR responses.
 *
 * Retries on 429 / 502 / 503 / 504. Honors `Retry-After` (seconds or HTTP-date)
 * when present, otherwise uses exponential backoff with jitter.
 *
 * Does NOT retry on 4xx other than 429 (those are real client errors).
 */

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export interface RetryOptions {
  maxAttempts: number;
  baseMs: number;
  capMs: number;
  /** Optional jitter factor (0..1). Default 0.5 (up to ±50% jitter). */
  jitter?: number;
  /** Sleep function — exposed for tests to use fake timers. */
  sleep?: (ms: number) => Promise<void>;
  /** Called on each retry; useful for observability. */
  onRetry?: (info: {
    attempt: number;
    status: number;
    delayMs: number;
    retryAfter?: string;
  }) => void;
}

const DEFAULTS: Required<Pick<RetryOptions, "maxAttempts" | "baseMs" | "capMs" | "jitter">> = {
  maxAttempts: 4,
  baseMs: 500,
  capMs: 8000,
  jitter: 0.5,
};

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Parse a Retry-After header value. Returns ms, or null if unparseable. */
export function parseRetryAfter(
  value: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Numeric seconds (RFC 7231 §7.1.3)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.ceil(Number(trimmed) * 1000));
  }
  // HTTP-date
  const ms = Date.parse(trimmed);
  if (!Number.isNaN(ms)) {
    return Math.max(0, ms - now);
  }
  return null;
}

function jittered(base: number, jitter: number): number {
  if (jitter <= 0) return base;
  const span = base * jitter;
  return Math.max(0, base + (Math.random() * 2 - 1) * span);
}

export interface WithRetryResult<T> {
  value: T;
  attempts: number;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly headers: Headers,
    msg: string,
  ) {
    super(msg);
    this.name = "HttpError";
  }
}

export async function withRetry<T>(
  fn: () => Promise<{ status: number; body: string; headers: Headers; value: () => T }>,
  options: Partial<RetryOptions> = {},
): Promise<{ value: T; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
  const baseMs = options.baseMs ?? DEFAULTS.baseMs;
  const capMs = options.capMs ?? DEFAULTS.capMs;
  const jitter = options.jitter ?? DEFAULTS.jitter;
  const sleep = options.sleep ?? realSleep;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await fn();
    } catch (err) {
      // Network error / abort — retry as transient
      lastError = err;
      if (attempt >= maxAttempts) throw err;
      const delayMs = jittered(Math.min(capMs, baseMs * 2 ** (attempt - 1)), jitter);
      options.onRetry?.({ attempt, status: 0, delayMs });
      await sleep(delayMs);
      continue;
    }

    if (res.status >= 200 && res.status < 300) {
      return { value: res.value(), attempts: attempt };
    }

    if (!RETRYABLE_STATUSES.has(res.status) || attempt >= maxAttempts) {
      throw new HttpError(
        res.status,
        res.body,
        res.headers,
        `FHIR request failed: ${res.status} (after ${attempt} attempt${attempt === 1 ? "" : "s"})`,
      );
    }

    const retryAfter = res.headers.get("retry-after");
    const parsed = parseRetryAfter(retryAfter);
    const base = parsed !== null ? parsed : Math.min(capMs, baseMs * 2 ** (attempt - 1));
    const delayMs = jittered(base, jitter);

    lastError = new HttpError(
      res.status,
      res.body,
      res.headers,
      `FHIR request failed: ${res.status} (attempt ${attempt} of ${maxAttempts})`,
    );

    options.onRetry?.({
      attempt,
      status: res.status,
      delayMs,
      retryAfter: retryAfter ?? undefined,
    });
    await sleep(delayMs);
  }

  // Unreachable in practice, but the type-checker wants it.
  throw lastError instanceof Error
    ? lastError
    : new Error("withRetry: exhausted attempts without success");
}
