import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getCurrentMarketValues } from "./current-values";
import { analyzeTransfers, type FeeVsValueData } from "./fee-vs-value";
import { fetchTopTransfers } from "./fetch-top-transfers";

/** The scrape, and only the scrape.
 *
 *  Transfers move once a day at most outside a deadline, and the whole fetch is
 *  8 pages, so a day's cache costs one scrape and keeps the page instant. Tagged
 *  so the header's refresh button can bust it (see app/api/revalidate).
 *
 *  What is cached is the raw table, which moves only when the scraper does —
 *  not the analysis on top of it. unstable_cache entries outlive deployments, so
 *  anything inside this closure keeps being served after a deploy that changed
 *  how it works. That cost a hand-bumped SHAPE_VERSION, nine of them, and the
 *  failure whenever someone forgot was silent: re-basing `ratio` on today's
 *  value left every type satisfied and the page served the previous formula's
 *  numbers for a day. Keeping the derivation outside means a deploy cannot ship
 *  beside a stale computation, because there is no cached computation. */
const fetchCached = unstable_cache(fetchTopTransfers, ["top-transfers"], {
  revalidate: 86400,
  tags: ["top-transfers"],
});

/** Priced against today's market values, fresh on every request.
 *
 *  `analyzeTransfers` is a map over 200 rows against a process-memoised lookup,
 *  so running it per request costs nothing measurable and buys back the whole
 *  cache-invalidation problem. It also drops `getDataVersion` from the picture:
 *  the committed dataset is no longer read from inside a cached region, so there
 *  is nothing to key on to make a data deploy miss. React's `cache` still
 *  dedupes it within a single render. */
export const getFeeVsValueData = cache(async (): Promise<FeeVsValueData> => {
  const [{ season, transfers }, currentValues] = await Promise.all([
    fetchCached(),
    getCurrentMarketValues(),
  ]);
  return analyzeTransfers(season, transfers, currentValues);
});
