# SquadStat — Domain & Architecture Context

Ubiquitous language for the codebase. Architecture vocabulary — **module, interface,
seam, adapter, depth, leverage, locality** — follows the `codebase-design` skill.

This file records agreed design, not only current reality: some entries are being
established incrementally (see each entry's migration note).

## Transfermarkt parser — `lib/transfermarkt/`

The single **module** that owns Transfermarkt's HTML DOM and CDN conventions. Cheerio is
imported in exactly one place; no other module knows a TM selector or image path. This is
the **seam** between "how Transfermarkt happens to render a page" and everything else.

- **Interface** — one deep parse method per page shape: `parsePlayerTable`,
  `parseManagerTable`, `parseStandings`, `parseProfileHeader`, `parseGroupResults`, … Each
  takes an HTML string and returns typed data; cheerio never appears in the interface.
- **player cell** — the `.inline-table` / `.hauptlink` player mini-table shared by every
  player-listing page. Parsed once into a **player identity** (name, playerId, profileUrl,
  headshot, position). Page-specific columns are read by the caller through a cheerio-free
  **row accessor** — `.text(i)`, `.image(i)`, `.link(i)`. Column positions are page-specific
  (they stay in the caller); the shared DOM walk lives in the module.
- **tmImage** — normalizes a scraped image URL to its largest size, and builds image URLs
  from an id (`crestUrl`, `flagUrl`, `leagueLogoUrl`). One CDN size vocabulary, both
  directions; the largest-size word is per family (portrait→`header`, crest→`head`, …).
- **profile header** — owns TM's _presentation_ vocabulary: ribbon → on-loan / new-signing,
  U-squad caps filtering, market-value display. Cross-source reconciliation (header caps vs
  the alpha API) and value typing (`parseMarketValue`) stay in the **fetcher**, not the parser.

Fetching stays out of the parser: `fetchPage` (and the refresh scripts) fetch; the parser is
pure `HTML → data`, so its **interface is the test surface** — exercised against saved-page
fixtures rather than the live site.

**Migration (in progress):** incremental — injured pilot → other player-listing pages →
bespoke tables (manager, standings, form, wc) → profile header → refresh scripts. Parity per
step, except an intended one-time shift to largest image sizes.

## Data surfaces

The async **server component** is the single data surface for internal data: a page calls the
`lib/` function directly and passes `initialData` to its client component. There is **no
parallel internal REST API**. `app/api/*` exists only for genuinely client-hit or operational
endpoints — player search, manager PPG (deferred), cache revalidation, data refresh, cron.

A route that merely re-wraps a `lib/` function a page already calls is **duplication, not
surface**, and gets deleted. Domain computation (e.g. `findValueCandidates`) lives in `lib/`
and runs server-side once; it is not re-run in the client or behind a route.
