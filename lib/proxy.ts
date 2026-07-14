/**
 * www.transfermarkt.com's AWS WAF hard-blocks datacenter IPs, so the GitHub Actions
 * data-refresh scraper gets 403s (and can't even solve a captcha — the block page
 * has no challenge widget). When TM_PROXY_URL is set we route www.transfermarkt.com
 * fetches through a residential proxy, so requests come from a clean IP WAF serves.
 *
 * Only spread this into www.transfermarkt.com requests. The alpha API host
 * (tmapi-alpha.transfermarkt.technology — national-career, club-types) is NOT
 * WAF-blocked, works direct from datacenter IPs, and does NOT route cleanly through
 * residential exits (fetch throws "Unable to connect"), so those calls stay direct.
 *
 * TM_PROXY_URL is only set in the Actions workflow — it's unset in Vercel production,
 * where fetches stay direct (Vercel's IPs aren't blocked and shouldn't pay proxy cost).
 * Bun's fetch honors the `proxy` option; the value is a full URL with embedded creds.
 */

/** Spread into a Bun `fetch` init to route the request through the proxy (no-op if unset). */
export function proxyInit(): { proxy?: string } {
  const url = process.env.TM_PROXY_URL;
  return url ? { proxy: url } : {};
}

/** The proxy in Playwright's launch shape (Chromium can't take inline URL creds). */
export function proxyLaunchOption(): {
  proxy?: { server: string; username: string; password: string };
} {
  const url = process.env.TM_PROXY_URL;
  if (!url) return {};
  const u = new URL(url);
  return {
    proxy: { server: `${u.protocol}//${u.host}`, username: u.username, password: u.password },
  };
}
