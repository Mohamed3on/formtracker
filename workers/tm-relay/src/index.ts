/**
 * Fetches www.transfermarkt.com on behalf of the GitHub Actions data-refresh scraper.
 *
 * Transfermarkt's AWS WAF blocks GitHub's Azure ranges — it answers them with HTTP 200 and
 * an empty body, so the scraper sees neither a 403 nor a captcha it could solve. Cloudflare's
 * egress is served normally, so the runner relays its fetches through here instead. Workers
 * egress is unmetered, which is the whole reason this exists rather than a residential proxy.
 *
 * The endpoint is public and its name is in this repo, so RELAY_SECRET is the only thing
 * keeping it from being an open proxy. The host allowlist is enforced separately, so a leaked
 * secret still can't point it at anything but Transfermarkt.
 *
 * Deployed by hand: `cd workers/tm-relay && bunx wrangler deploy`.
 */

const ALLOWED_HOST = "www.transfermarkt.com";

// Cloudflare stamps the caller's IP onto the incoming request. Forwarding those upstream would
// hand Transfermarkt the very Azure IP this relay exists to hide, so they never get copied.
const BLOCKED_PREFIXES = ["cf-", "x-forwarded-"];
const BLOCKED_HEADERS = new Set(["x-relay-secret", "host", "x-real-ip"]);

// Compares every character rather than bailing on the first mismatch. Workers offer a native
// crypto.subtle.timingSafeEqual, but it's absent from the DOM lib this repo typechecks against
// and isn't worth a second tsconfig: remote timing attacks on a 32-byte random secret aren't
// the threat here, a leaked or committed secret is.
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function forwardedHeaders(incoming: Headers): Headers {
  const out = new Headers();
  for (const [key, value] of incoming) {
    const k = key.toLowerCase();
    if (BLOCKED_HEADERS.has(k)) continue;
    if (BLOCKED_PREFIXES.some((p) => k.startsWith(p))) continue;
    out.set(key, value);
  }
  return out;
}

export default {
  async fetch(request: Request, env: { RELAY_SECRET: string }): Promise<Response> {
    const given = request.headers.get("x-relay-secret");
    if (!given || !env.RELAY_SECRET || !secretMatches(given, env.RELAY_SECRET)) {
      // Logged without the offered secret — this endpoint is public, so scanners land here.
      console.warn("[relay] rejected: bad or missing secret");
      return new Response("forbidden", { status: 403 });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) return new Response("missing url param", { status: 400 });

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return new Response("malformed url param", { status: 400 });
    }
    // Exact match, never includes() — evil.com/?x=www.transfermarkt.com must not pass.
    if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_HOST) {
      console.warn(`[relay] rejected: host not allowed (${parsed.hostname})`);
      return new Response("host not allowed", { status: 403 });
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        method: "GET",
        headers: forwardedHeaders(request.headers),
      });
      // The signature of Transfermarkt starting to block Cloudflare too. Cheap to log, and
      // it's the one line that would explain an otherwise baffling refresh failure.
      const len = upstream.headers.get("content-length");
      if (upstream.status !== 200 || len === "0") {
        console.warn(`[relay] upstream ${upstream.status} len=${len ?? "?"} ${parsed.pathname}`);
      }
      // Status and body stream through untouched: if WAF ever starts blocking Cloudflare too,
      // the caller sees the same empty 200 it would have seen directly and reacts as it does now.
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "text/html; charset=utf-8",
        },
      });
    } catch (err) {
      return new Response(`relay fetch failed: ${err}`, { status: 502 });
    }
  },
};
