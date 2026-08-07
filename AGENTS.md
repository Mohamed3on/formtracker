# SquadStat Development Guide

Use `bun` for all commands (not npm/yarn).

## Development

Don't run `bun run build` during development - the dev server is already running.

## UI Components

Use [shadcn/ui](https://ui.shadcn.com) for all UI components. Install new components with `npx shadcn@latest add <component>`. Never build custom UI primitives when a shadcn component exists.

**No inline styles:** Use Tailwind classes (including `data-[state=on]:`, `hover:`, `active:` variants) instead of `style={{}}`. Inline styles override Tailwind's interactive states. For CSS variables, use Tailwind's arbitrary value syntax: `text-[var(--text-muted)]`, `bg-[var(--bg-card)]`, `border-[var(--border-subtle)]`.

**No custom pixel widths:** Never use arbitrary width values like `w-[200px]`, `max-w-[140px]`, `min-w-[3rem]`. Use Tailwind's built-in sizing scale (`w-48`, `min-w-48`, `max-w-sm`) or let content size naturally. Exception: native shadcn/ui component internals may use custom widths.

**Mobile-first responsive design:** All layouts must work on mobile and desktop. Always test both breakpoints mentally when writing markup. Use `flex-col sm:flex-row`, `hidden sm:block`, and responsive variants (`sm:`, `md:`) to adapt layouts. Never ship desktop-only designs.

**Reusable components:** Always think in reusable components. Before creating a new component, look for existing components with similar structure and extract a shared base. Actively look for opportunities to consolidate duplicated UI patterns and logic across the codebase.

**Numeric values:** All numbers (money, percentages, stats, counts) must use the `font-value` class for monospace rendering. Never use `font-bold`/`font-black` on numbers — let the mono font speak for itself.

**Typography weights:** Never use `font-bold` or `font-semibold` on large/prominent Geist Sans text (section headers, headings). Use `font-pixel font-bold` for those instead. Small bold is fine: player/team names, numbers, badges, inline links.

## Performance

- **Server-side data fetching:** Always fetch data in async server components and pass as `initialData` props to client components. Never use client-side `useQuery`/`fetch` waterfalls. Use Next.js `loading.tsx` for streaming skeletons while server fetches. See `expected-position`, `injured`, `minutes-value` pages for the pattern.
- **Parallel fetching:** Use `Promise.all` / `Promise.allSettled` for independent data fetches.
- **Caching:** All API routes that fetch from Transfermarkt must use `unstable_cache` (see below).
- **Retries:** Wrap external fetches with retry logic (exponential backoff, max 3 attempts) for rate-limited or flaky responses.
- **Client:** Prefer server components. Only use `"use client"` when interactivity is required.

## Caching Strategy

All API routes that fetch from Transfermarkt should use `unstable_cache` for daily caching:

```typescript
import { unstable_cache } from "next/cache";

const getData = unstable_cache(
  async () => {
    // fetch logic
  },
  ["cache-key"],
  { revalidate: 86400, tags: ["tag-name"] }, // 24 hour cache
);
```

**Important:** When adding a new cached route, always add its tag to `/app/api/revalidate/route.ts`:

```typescript
revalidateTag("your-new-tag");
```

This ensures the header refresh button properly busts all caches.

**Caches over committed `data/*.json` files are different.** `unstable_cache` entries survive
deployments, so they go stale the moment CI commits fresh data. Plain file reads (see
`lib/biggest-movers.ts`) need no `unstable_cache` at all — they're fresh every deploy. If the
derived computation is expensive enough to cache (see `lib/player-detail.ts`), include
`getDataVersion()` from `lib/data-version.ts` in the cache key so each data deploy misses cleanly.

## Debugging Transfermarkt Pages

Use `curl` (not WebFetch) to inspect Transfermarkt HTML — match the headers from `lib/fetch.ts`:

```bash
curl -s -L -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" "https://www.transfermarkt.com/x/leistungsdaten/spieler/294057" | grep -A1 'content-box-headline'
```

## Transfermarkt Relay (CI only)

Transfermarkt's WAF blocks GitHub's Azure ranges with an HTTP 200 and an **empty body** — no
403, and no captcha to solve. Cloudflare and AWS egress are served normally, so CI relays every
TM fetch through `workers/tm-relay`. Local and Vercel production leave `TM_RELAY_URL` unset and
fetch direct, which is why debugging with plain `curl` above still works.

```bash
cd workers/tm-relay && bunx wrangler deploy   # deployed by hand; changes ~never
bunx wrangler tail                            # live relay traffic
```

Rotating the secret means setting it in **both** places, or CI 403s:

```bash
S=$(openssl rand -hex 32)
printf %s "$S" | bunx wrangler secret put RELAY_SECRET   # in workers/tm-relay
printf %s "$S" | gh secret set TM_RELAY_SECRET
```

If TM ever blocks Cloudflare too (`[relay] upstream 200 len=0` in the Worker log, or
`Rate limited (0b)` in the run), point `TM_RELAY_URL` at another unblocked host — AWS works.

**The refresh alert skips when any `scraper-broken` issue is open.** Close it when you fix the
thing, or you're blind to the next failure.

**Every failed refresh run also pings Telegram** via `notify-refresh-failure.yml` — a
`workflow_run` trigger, so it fires even for timeouts and runs GitHub's runner infra never
picked up (which the in-job alert step can't see). Needs `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID` secrets.

## Season Rollover

TM keys seasons by starting year and flips its date-based ID on Aug 1 (`tmCurrentSeasonId`),
weeks before the big leagues kick off. The refresh keeps aggregating the **previous** season
until ≥35% of the pool has played games in the new one (`chooseSeason` in
`lib/season-selection.ts`), then flips automatically — never edit a hardcoded season into the
scrapers. The chosen season is committed to `data/season.txt`; when it changes, the
old-vs-new regression guards skip for that one run (a flip legitimately resets every stat).
ceapi payloads carry each player's full career, which is what makes aggregating a past season
(and the "last-season coverage ≥70%" scraper-health guard) possible.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
