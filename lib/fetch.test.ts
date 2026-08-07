import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./tm-relay", () => ({ tmFetch: vi.fn() }));

import { tmFetch } from "./tm-relay";
import { fetchJson, fetchPage } from "./fetch";

const mocked = vi.mocked(tmFetch);
const LONG_HTML = "<html>" + "x".repeat(600) + "</html>";
const res = (body: string, status = 200) => new Response(body, { status });

beforeEach(() => {
  vi.useFakeTimers();
  mocked.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Run a fetch call while auto-advancing fake timers through the backoff. */
async function withBackoff<T>(p: Promise<T>): Promise<T> {
  // Suppress unhandled-rejection noise while timers advance; the caller awaits p.
  p.catch(() => {});
  for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(20_000);
  return p;
}

describe("fetchPage", () => {
  it("returns a healthy body without retrying", async () => {
    mocked.mockResolvedValueOnce(res(LONG_HTML));
    await expect(fetchPage("https://tm/x")).resolves.toBe(LONG_HTML);
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("retries rate-limit-sized bodies (and empty WAF 200s) until healthy", async () => {
    mocked.mockResolvedValueOnce(res("")).mockResolvedValueOnce(res(LONG_HTML));
    await expect(withBackoff(fetchPage("https://tm/x"))).resolves.toBe(LONG_HTML);
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it("treats 4xx as fatal — no retries, reason carried", async () => {
    mocked.mockResolvedValueOnce(res("forbidden", 403));
    await expect(fetchPage("https://tm/x")).rejects.toThrow("HTTP 403: forbidden");
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("treats 5xx as transient — retried, then succeeds", async () => {
    mocked.mockResolvedValueOnce(res("maintenance", 503)).mockResolvedValueOnce(res(LONG_HTML));
    await expect(withBackoff(fetchPage("https://tm/x"))).resolves.toBe(LONG_HTML);
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it("gives up after max retries with the last reason", async () => {
    mocked.mockImplementation(async () => res("", 200));
    await expect(withBackoff(fetchPage("https://tm/x"))).rejects.toThrow(
      /Failed after 5 retries \(rate limited/,
    );
    expect(mocked).toHaveBeenCalledTimes(5);
  });

  it("retries network errors", async () => {
    mocked.mockRejectedValueOnce(new Error("socket hang up")).mockResolvedValueOnce(res(LONG_HTML));
    await expect(withBackoff(fetchPage("https://tm/x"))).resolves.toBe(LONG_HTML);
    expect(mocked).toHaveBeenCalledTimes(2);
  });
});

describe("fetchJson", () => {
  it("parses small valid JSON (no length heuristic)", async () => {
    mocked.mockResolvedValueOnce(res('{"data":{"performance":[]}}'));
    await expect(fetchJson("https://tm/ceapi")).resolves.toEqual({ data: { performance: [] } });
  });

  it("retries non-JSON bodies (maintenance HTML, empty WAF 200)", async () => {
    mocked
      .mockResolvedValueOnce(res("<!doctype html>maintenance"))
      .mockResolvedValueOnce(res('{"ok":true}'));
    await expect(withBackoff(fetchJson("https://tm/ceapi"))).resolves.toEqual({ ok: true });
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it("treats 4xx as fatal", async () => {
    mocked.mockResolvedValueOnce(res("nope", 404));
    await expect(fetchJson("https://tm/ceapi")).rejects.toThrow("HTTP 404");
    expect(mocked).toHaveBeenCalledTimes(1);
  });
});
