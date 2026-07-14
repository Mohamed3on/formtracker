import { proxyInit } from "./proxy";

const BASE_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Cache-Control": "no-cache",
};

function getHeaders(): Record<string, string> {
  return process.env.TM_COOKIE ? { ...BASE_HEADERS, Cookie: process.env.TM_COOKIE } : BASE_HEADERS;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
// Transfermarkt pages average ~4s, so wall time is roughly sum(latency)/maxConcurrent.
// Measured across 12 history pages: 4 concurrent → 3.6s, 12 concurrent → 1.7s, with no
// rate-limiting or 5xx from TM either way. 10 keeps most of that win with headroom.
let maxConcurrent = 10;

/** Override the concurrency limit (e.g. for batch scripts with their own backoff). */
export function setMaxConcurrent(n: number) {
  maxConcurrent = n;
}

let active = 0;
const queue: (() => void)[] = [];

async function acquireSlot() {
  while (active >= maxConcurrent) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active++;
}

function releaseSlot() {
  active--;
  queue.shift()?.();
}

export async function fetchPage(
  url: string,
  revalidate?: number,
  extraHeaders?: Record<string, string>,
): Promise<string> {
  await acquireSlot();
  try {
    return await fetchPageInner(url, revalidate, extraHeaders);
  } finally {
    releaseSlot();
  }
}

/** Run an async operation under the shared Transfermarkt concurrency limit. */
export async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

async function fetchPageInner(
  url: string,
  revalidate?: number,
  extraHeaders?: Record<string, string>,
): Promise<string> {
  const headers = { ...getHeaders(), ...extraHeaders };
  const cacheOpts =
    revalidate !== undefined ? { next: { revalidate } } : { cache: "no-store" as const };
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers, ...proxyInit(), ...cacheOpts });
      if (response.status >= 400) {
        // 4xx/5xx = WAF block or server error — retrying won't help, need a new token
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      // Transfermarkt rate-limit responses are ~146 bytes — only these are worth retrying
      if (html.length > 500) return html;
      console.warn(
        `[fetch] Rate limited (${html.length}b), retry ${attempt + 1}/${MAX_RETRIES}: ${url}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("HTTP ")) throw err; // Don't retry HTTP errors
      console.warn(`[fetch] ${msg}, retry ${attempt + 1}/${MAX_RETRIES}: ${url}`);
    }
    if (attempt < MAX_RETRIES - 1) {
      const jitter = Math.random() * 500;
      await new Promise((r) => setTimeout(r, BASE_DELAY * 2 ** attempt + jitter));
    }
  }
  throw new Error(`[fetch] Failed after ${MAX_RETRIES} retries: ${url}`);
}
