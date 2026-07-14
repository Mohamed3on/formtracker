/**
 * www.transfermarkt.com's AWS WAF *intermittently* hard-blocks datacenter IPs, so the
 * GitHub Actions data-refresh scraper sometimes gets 403s (and then can't even solve a
 * captcha — the block page has no challenge widget). TM_PROXY_URL points at a residential
 * proxy that WAF serves normally.
 *
 * Direct-first: tmFetch() hits the datacenter IP directly and only latches onto the proxy
 * once a request is actually WAF-blocked. A flagged IP stays flagged for the whole run, so
 * the switch is one-way. Most runs land on a clean IP and never touch the proxy — residential
 * bandwidth is metered, so we only spend it when the direct IP genuinely fails. Each scraper
 * process latches independently.
 *
 * Only route www.transfermarkt.com through tmFetch. The alpha API host
 * (tmapi-alpha.transfermarkt.technology — national-career, club-types) is NOT WAF-blocked,
 * works direct from datacenter IPs, and does NOT route cleanly through residential exits
 * (fetch throws "Unable to connect"), so those calls use plain fetch, never tmFetch.
 *
 * TM_PROXY_URL is only set in the Actions workflow — unset in Vercel production, where
 * fetches stay direct. Bun's fetch honors the `proxy` option (a full URL with creds).
 */

// Flips to true after the first WAF block; sticky for the process lifetime.
let proxied = false;

/** Force every subsequent TM fetch through the proxy. solve-captcha only runs when the
 *  direct IP is already known-blocked, so it shouldn't waste attempts rediscovering that. */
export function forceTmProxy(): void {
  proxied = true;
}

// The proxy URL, but only once we've latched onto it (and only if one is configured).
function activeProxyUrl(): string | undefined {
  return proxied ? process.env.TM_PROXY_URL : undefined;
}

/** Spread into a Bun `fetch` init to route through the proxy once latched (no-op otherwise). */
export function proxyInit(): { proxy?: string } {
  const url = activeProxyUrl();
  return url ? { proxy: url } : {};
}

/** The active proxy in Playwright's launch shape (Chromium can't take inline URL creds). */
export function proxyLaunchOption(): {
  proxy?: { server: string; username: string; password: string };
} {
  const url = activeProxyUrl();
  if (!url) return {};
  const u = new URL(url);
  return {
    proxy: { server: `${u.protocol}//${u.host}`, username: u.username, password: u.password },
  };
}

// 403 = WAF block, 429 = rate limit, 5xx = throttle/server — all mean "this IP is unhappy".
// 404 and other 4xx are real responses, not a reason to fail over.
function isBlocked(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}

/**
 * Fetch a www.transfermarkt.com URL direct-first. On the first WAF block from the direct IP,
 * latch to the proxy for the rest of the run and retry the request once. When TM_PROXY_URL is
 * unset (e.g. Vercel production) it's a plain direct fetch with no fallback.
 */
export async function tmFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, ...proxyInit() });
  if (!proxied && process.env.TM_PROXY_URL && isBlocked(res.status)) {
    proxied = true;
    console.warn(
      `[proxy] direct IP got HTTP ${res.status} — routing remaining Transfermarkt fetches through the proxy`,
    );
    return fetch(url, { ...init, ...proxyInit() });
  }
  return res;
}
