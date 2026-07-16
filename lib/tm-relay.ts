/**
 * www.transfermarkt.com's AWS WAF blocks GitHub's Azure ranges, answering them with HTTP 200
 * and an empty body — no 403, and no captcha to solve, since a hard block serves no challenge
 * widget. Cloudflare and AWS egress are both served normally, so CI relays its Transfermarkt
 * fetches through a Worker (workers/tm-relay) that has an IP Transfermarkt will talk to.
 *
 * Every fetch goes through the relay rather than trying direct first: Workers egress is
 * unmetered, so there's nothing to save by probing direct, and a direct-first fallback would
 * need block-detection in every caller to be correct.
 *
 * TM_RELAY_URL is only set in the Actions workflow. Vercel production leaves it unset and
 * fetches direct — AWS isn't blocked, and prod requests are user-facing, so the extra hop
 * would be latency for nothing.
 *
 * Only route www.transfermarkt.com through tmFetch. The alpha API host
 * (tmapi-alpha.transfermarkt.technology — national-career, club-types) is NOT WAF-blocked and
 * works direct from datacenter IPs, so those calls use plain fetch, never tmFetch.
 */

/**
 * Fetch a www.transfermarkt.com URL through the relay when one is configured, else direct.
 * Relay rejections surface as 4xx/5xx, which callers already treat as fatal rather than retry.
 */
export async function tmFetch(url: string, init?: RequestInit): Promise<Response> {
  const relay = process.env.TM_RELAY_URL;
  if (!relay) return fetch(url, init);

  return fetch(`${relay}?url=${encodeURIComponent(url)}`, {
    ...init,
    headers: { ...init?.headers, "X-Relay-Secret": process.env.TM_RELAY_SECRET ?? "" },
  });
}
