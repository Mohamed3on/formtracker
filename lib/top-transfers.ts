import { unstable_cache } from "next/cache";
import { analyzeTransfers, type FeeVsValueData } from "./fee-vs-value";
import { fetchTopTransfers } from "./fetch-top-transfers";

/** Transfers move once a day at most outside a deadline, and the whole fetch is
 *  8 pages, so a day's cache costs one scrape and keeps the page instant. Tagged
 *  so the header's refresh button can bust it (see app/api/revalidate). */
export const getFeeVsValueData = unstable_cache(
  async (): Promise<FeeVsValueData> => {
    const { season, transfers } = await fetchTopTransfers();
    return analyzeTransfers(season, transfers);
  },
  ["fee-vs-value"],
  { revalidate: 86400, tags: ["top-transfers"] },
);
