import { describe, it, expect, vi } from "vitest";
import { withRetry, parseRetryAfter, HttpError } from "./retry.js";

const ok = (
  body = "ok",
): { status: number; body: string; headers: Headers; value: () => string } => ({
  status: 200,
  body,
  headers: new Headers(),
  value: () => body,
});

const fail = (status: number, body = "boom", retryAfter?: string): never =>
  ({
    status,
    body,
    headers: new Headers(retryAfter ? { "retry-after": retryAfter } : {}),
    value: () => {
      throw new Error("should not be called on failure");
    },
  }) as never;

const noSleep = (): Promise<void> => Promise.resolve();
const captureSleep = () => {
  const calls: number[] = [];
  return {
    sleep: async (ms: number): Promise<void> => {
      calls.push(ms);
    },
    calls,
  };
};

describe("parseRetryAfter", () => {
  it("returns null for null/empty/unparseable", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("not a date")).toBeNull();
  });

  it("parses integer seconds", () => {
    expect(parseRetryAfter("5")).toBe(5000);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("parses fractional seconds (rounded up)", () => {
    expect(parseRetryAfter("1.4")).toBe(1400);
  });

  it("parses HTTP-date relative to now", () => {
    const now = Date.parse("2026-07-23T12:00:00Z");
    const inTwoSeconds = new Date(now + 2000).toUTCString();
    expect(parseRetryAfter(inTwoSeconds, now)).toBe(2000);
  });

  it("clamps negative deltas to 0 (server says 'retry in the past')", () => {
    const now = Date.parse("2026-07-23T12:00:00Z");
    const inPast = new Date(now - 5000).toUTCString();
    expect(parseRetryAfter(inPast, now)).toBe(0);
  });
});

describe("withRetry", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockReturnValue(ok("hello"));
    const result = await withRetry(fn, { sleep: noSleep });
    expect(result).toEqual({ value: "hello", attempts: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries 429 then succeeds", async () => {
    const fn = vi.fn().mockReturnValueOnce(fail(429, "rate-limited")).mockReturnValueOnce(ok("ok"));
    const { sleep, calls } = captureSleep();
    const result = await withRetry(fn, { sleep, jitter: 0 });
    expect(result).toEqual({ value: "ok", attempts: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([500]);
  });

  it("retries 503 then succeeds", async () => {
    const fn = vi
      .fn()
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(ok("ok"));
    const { sleep, calls } = captureSleep();
    const result = await withRetry(fn, { sleep, jitter: 0 });
    expect(result).toEqual({ value: "ok", attempts: 3 });
    expect(calls).toEqual([500, 1000]);
  });

  it("exponential backoff doubles each attempt up to the cap", async () => {
    const fn = vi
      .fn()
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(ok("ok"));
    const { sleep, calls } = captureSleep();
    const result = await withRetry(fn, {
      sleep,
      maxAttempts: 5,
      baseMs: 100,
      capMs: 1000,
      jitter: 0,
    });
    expect(result.attempts).toBe(5);
    // backoff: 100, 200, 400, 800 (then 1000 cap, but we succeeded before that)
    expect(calls).toEqual([100, 200, 400, 800]);
  });

  it("respects capMs on exponential backoff", async () => {
    const fn = vi
      .fn()
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(ok("ok"));
    const { sleep, calls } = captureSleep();
    await withRetry(fn, { sleep, baseMs: 1000, capMs: 1500, jitter: 0 });
    // backoff: 1000, 1500 (capped), 1500 (capped)
    expect(calls).toEqual([1000, 1500, 1500]);
  });

  it("honors Retry-After header (seconds)", async () => {
    const fn = vi
      .fn()
      .mockReturnValueOnce(fail(429, "rate-limited", "2"))
      .mockReturnValueOnce(ok("ok"));
    const { sleep, calls } = captureSleep();
    const result = await withRetry(fn, { sleep, jitter: 0 });
    expect(result.attempts).toBe(2);
    expect(calls).toEqual([2000]);
  });

  it("does NOT retry 4xx other than 429", async () => {
    const fn = vi.fn().mockReturnValueOnce(fail(403, "forbidden"));
    const { sleep, calls } = captureSleep();
    await expect(withRetry(fn, { sleep })).rejects.toThrow(/FHIR request failed: 403/);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it("does NOT retry 501 (5xx but not transient)", async () => {
    const fn = vi.fn().mockReturnValueOnce(fail(501, "not implemented"));
    const { sleep, calls } = captureSleep();
    await expect(withRetry(fn, { sleep })).rejects.toThrow(/FHIR request failed: 501/);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it("gives up after maxAttempts and throws HttpError on the last response", async () => {
    const fn = vi.fn().mockReturnValue(fail(503, "down"));
    const { sleep, calls } = captureSleep();
    await expect(withRetry(fn, { sleep, maxAttempts: 3 })).rejects.toThrow(HttpError);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(calls).toHaveLength(2);
  });

  it("retries on network error then succeeds", async () => {
    const netErr = new Error("ECONNRESET");
    const fn = vi.fn().mockRejectedValueOnce(netErr).mockReturnValueOnce(ok("ok"));
    const { sleep, calls } = captureSleep();
    const result = await withRetry(fn, { sleep, jitter: 0 });
    expect(result).toEqual({ value: "ok", attempts: 2 });
    expect(calls).toEqual([500]);
  });

  it("throws the last network error after exhausting attempts", async () => {
    const netErr = new Error("ECONNRESET");
    const fn = vi.fn().mockRejectedValue(netErr);
    const { sleep } = captureSleep();
    await expect(withRetry(fn, { sleep, maxAttempts: 2 })).rejects.toThrow(/ECONNRESET/);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("invokes onRetry callback for each retry", async () => {
    const fn = vi
      .fn()
      .mockReturnValueOnce(fail(429, "rl", "1"))
      .mockReturnValueOnce(fail(503))
      .mockReturnValueOnce(ok("ok"));
    const events: Array<{ attempt: number; status: number; retryAfter?: string }> = [];
    await withRetry(fn, {
      sleep: noSleep,
      onRetry: (info) =>
        events.push({ attempt: info.attempt, status: info.status, retryAfter: info.retryAfter }),
    });
    expect(events).toEqual([
      { attempt: 1, status: 429, retryAfter: "1" },
      { attempt: 2, status: 503, retryAfter: undefined },
    ]);
  });
});
