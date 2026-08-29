import { unstable_cache } from "next/cache";
import { analyzeTransfers, type FeeVsValueData } from "./fee-vs-value";
import { fetchTopTransfers } from "./fetch-top-transfers";

/** Bump whenever the shape of FeeVsValueData changes.
 *
 *  unstable_cache entries outlive deployments, so without this a shape change
 *  ships to a cache still holding the old one and the page throws on the missing
 *  field until the day's TTL lapses. Adding a field to ClubPremium did exactly
 *  that in development, which is the only reason it isn't doing it in
 *  production. Version it and every such deploy misses cleanly instead. */
const SHAPE_VERSION = "3";

/** Transfers move once a day at most outside a deadline, and the whole fetch is
 *  8 pages, so a day's cache costs one scrape and keeps the page instant. Tagged
 *  so the header's refresh button can bust it (see app/api/revalidate). */
export const getFeeVsValueData = unstable_cache(
  async (): Promise<FeeVsValueData> => {
    const { season, transfers } = await fetchTopTransfers();
    return analyzeTransfers(season, transfers);
  },
  ["fee-vs-value", SHAPE_VERSION],
  { revalidate: 86400, tags: ["top-transfers"] },
);
