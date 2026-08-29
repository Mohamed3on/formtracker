import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getCurrentMarketValues } from "./current-values";
import { getDataVersion } from "./data-version";
import { analyzeTransfers, type FeeVsValueData } from "./fee-vs-value";
import { fetchTopTransfers } from "./fetch-top-transfers";

/** Bump whenever the shape **or the meaning** of FeeVsValueData changes.
 *
 *  unstable_cache entries outlive deployments, so without this a change ships to
 *  a cache still holding the old result and that result keeps being served until
 *  the day's TTL lapses. Adding a field to ClubPremium threw on the missing
 *  field, which at least announced itself. The quieter failure is a changed
 *  computation over an unchanged shape: re-basing `ratio` on `currentValue` left
 *  every type satisfied and the page happily served the previous formula's
 *  numbers. Shape is the obvious trigger, not the only one — if the bytes this
 *  function would return today differ from yesterday's, bump it. */
const SHAPE_VERSION = "8";

/** Transfers move once a day at most outside a deadline, and the whole fetch is
 *  8 pages, so a day's cache costs one scrape and keeps the page instant. Tagged
 *  so the header's refresh button can bust it (see app/api/revalidate). */
export const getFeeVsValueData = cache(async (): Promise<FeeVsValueData> => {
  // The analysis now joins today's market values off the committed dataset, so
  // the cache has to miss when that data is redeployed as well as when the TTL
  // lapses — otherwise a data refresh ships beside a day-old join.
  const dataVersion = await getDataVersion();
  return unstable_cache(
    async () => {
      const [{ season, transfers }, currentValues] = await Promise.all([
        fetchTopTransfers(),
        getCurrentMarketValues(),
      ]);
      return analyzeTransfers(season, transfers, currentValues);
    },
    ["fee-vs-value", SHAPE_VERSION, dataVersion],
    { revalidate: 86400, tags: ["top-transfers"] },
  )();
});
