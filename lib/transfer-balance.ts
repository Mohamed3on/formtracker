import { readFile } from "fs/promises";
import { join } from "path";
import { cache } from "react";
import type {
  TransferBalanceClub,
  TransferBalanceMetric,
  TransferBalanceResult,
} from "@/app/types";

/** Plain per-request read, deduped with React cache. data/transfer-balance.json only
 *  changes via a data-refresh deploy, so an unstable_cache could only serve it stale. */
export const getTransferBalance = cache(async (): Promise<TransferBalanceResult> => {
  const raw = await readFile(join(process.cwd(), "data", "transfer-balance.json"), "utf-8");
  return JSON.parse(raw) as TransferBalanceResult;
});

/** What each measure is called in prose. The transfer-balance page titles two of
 *  them as superlatives on its leader cards ("Biggest net spender"); these are
 *  the plain nouns a position reads with — "#3 by net spend". */
export const BALANCE_METRIC: Record<TransferBalanceMetric, string> = {
  expenditure: "gross spend",
  income: "sales",
  netSpender: "net spend",
  netProfit: "net profit",
};

/**
 * How deep a place taken from this dataset is still a real place.
 *
 * The scrape unions four top-25 pages of one Transfermarkt table (see
 * scripts/refresh-transfer-balance.ts), so every club above the 25th on a
 * measure is necessarily in the set — sorting the union on that measure
 * reproduces the true order exactly as far as 25. Past that a club's place is
 * only a lower bound, because the clubs that would sit between it and the ones
 * above are precisely the ones the scrape never fetched. So positions are
 * reported only where they are exact, and a club simply goes unplaced on a
 * measure it isn't near the top of.
 */
const RANKED_DEPTH = 25;

/** Which figure a measure ranks on, and who is entitled to be ranked on it at
 *  all. Balance is read from both ends: a club that banked money is placed
 *  among the profit-makers and one that spent it among the spenders, because
 *  "3rd biggest net spender" is false of a club that came out ahead however the
 *  sort happens to order it. */
const MEASURES: Record<TransferBalanceMetric, (c: TransferBalanceClub) => number | null> = {
  expenditure: (c) => (c.expenditure > 0 ? c.expenditure : null),
  income: (c) => (c.income > 0 ? c.income : null),
  netProfit: (c) => (c.balance > 0 ? c.balance : null),
  netSpender: (c) => (c.balance < 0 ? -c.balance : null),
};

/** One club's row in one window, with the places it can claim. */
export interface ClubBalanceWindow {
  seasons: number;
  /** `26/27`, or `24/25 – 26/27` for a multi-season window. */
  label: string;
  club: TransferBalanceClub;
  ranks: Partial<Record<TransferBalanceMetric, number>>;
}

/**
 * A club's transfer money, window by window, newest span first.
 *
 * Empty for a club that tops none of the four measures in any window, which is
 * every club outside the world's biggest two dozen buyers and sellers — the
 * dataset only reaches that far. Ties share a place.
 */
export async function getClubTransferBalance(clubId: string): Promise<ClubBalanceWindow[]> {
  const { windows } = await getTransferBalance();

  return windows.flatMap(({ seasons, label, clubs }) => {
    const club = clubs.find((c) => c.id === clubId);
    if (!club) return [];

    const ranks: ClubBalanceWindow["ranks"] = {};
    for (const [metric, measure] of Object.entries(MEASURES) as [
      TransferBalanceMetric,
      (typeof MEASURES)[TransferBalanceMetric],
    ][]) {
      const mine = measure(club);
      if (mine === null) continue;
      const place = clubs.filter((c) => (measure(c) ?? -Infinity) > mine).length + 1;
      if (place <= RANKED_DEPTH) ranks[metric] = place;
    }

    return [{ seasons, label, club, ranks }];
  });
}
