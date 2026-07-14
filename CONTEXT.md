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
- **tmImage** — normalizes a scraped image URL to its largest size (one rule, replacing the
  six ad-hoc size regexes that were scattered across the scrapers). The largest-size word is
  per family (portrait→`header`, crest→`head`, flag→`head`, logo→`header`). It also builds image
  URLs from an id at each family's largest size — `crestUrl` / `flagUrl` / `leagueLogoUrl`, used
  by the refresh scripts and `leagues.ts`. These live in the cheerio-free `image` submodule;
  import them from `@/lib/transfermarkt/image` (not the barrel) so pure/client-reachable callers
  like `leagues.ts` don't pull cheerio into their bundle.
- **attr(i, selector, name)** — a bounded escape hatch on the row accessor for genuinely
  bespoke cells (e.g. the movers page keeps the previous value in a `<span title>`). Prefer
  the typed `text` / `image` / `imageTitle` / `link` accessors.
- **profile header** — owns TM's _presentation_ vocabulary: ribbon → on-loan / new-signing,
  U-squad caps filtering, market-value display. Cross-source reconciliation (header caps vs
  the alpha API) and value typing (`parseMarketValue`) stay in the **fetcher**, not the parser.

Fetching stays out of the parser: `fetchPage` (and the refresh scripts) fetch; the parser is
pure `HTML → data`, so its **interface is the test surface** — exercised against saved-page
fixtures rather than the live site.

**Migration status.** Done: every player-listing scraper (injured, minutes-value, top-scorers,
biggest-movers) parses through `parsePlayerTable`; the profile header through
`parseProfileHeader`; all scraped-image rewriting through `tmImage`. Each step was
parity-verified against a saved fixture (identical output except the intended shift to largest
image sizes) and locked with a fixture test.

Intentionally **not** folded into the module: the bespoke table parses in `fetch-manager`
(managers), `team-form` / `form-analysis` (club standings, chosen among tables by header text),
and `wc/*` (group brackets, fixtures). They parse different entities, not the player-listing
shape, so a shared parser would take table-selection logic as parameters — moving DOM knowledge
into the module's signature rather than concentrating duplication. Their image rewriting already
goes through `tmImage`. `check-mv-updates` (a CI date check with no player identity) likewise
keeps its own three lines of cheerio.

## Data surfaces

The async **server component** is the single data surface for internal data: a page calls the
`lib/` function directly and passes `initialData` to its client component. There is **no
parallel internal REST API**. `app/api/*` exists only for genuinely client-hit or operational
endpoints — player search, manager PPG (deferred), cache revalidation, data refresh, cron.

A route that merely re-wraps a `lib/` function a page already calls is **duplication, not
surface**, and gets deleted. Domain computation (e.g. `findValueCandidates`) lives in `lib/`
and runs server-side once; it is not re-run in the client or behind a route.
