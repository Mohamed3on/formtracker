import { readFile } from "fs/promises";
import { join } from "path";
import { cache } from "react";
import type { TopTransfer } from "@/app/types";

/** A transfer with its fee-vs-market-value gap resolved. `premium` is the cash
 *  above (or below) what TM thought the player was worth; `ratio` is the same
 *  gap as a multiple, which is what separates a €10m overpay on a €5m player
 *  from a €10m overpay on a €100m one. */
export interface PricedTransfer extends TopTransfer {
  premium: number;
  ratio: number;
}

/** Transfers split by what the buying club actually did. Only `paid` moves have
 *  a negotiated price, so they're the only ones the premium/ratio rankings can
 *  compare: a loan has no fee at all in this table (TM ranks it by its own
 *  internal transfer value), and a free transfer is an expired contract rather
 *  than a bargain struck — both would sit at the bottom of every discount list
 *  on a technicality and crowd out the real ones. */
export interface FeeVsValueData {
  season: number;
  paid: PricedTransfer[];
  free: TopTransfer[];
  loans: TopTransfer[];
  totals: { fees: number; marketValue: number; premium: number; ratio: number };
  clubs: ClubPremium[];
}

export interface ClubPremium {
  club: TopTransfer["to"];
  signings: number;
  fees: number;
  marketValue: number;
  premium: number;
  ratio: number;
}

function price(t: TopTransfer): PricedTransfer {
  return {
    ...t,
    premium: t.fee - t.marketValue,
    ratio: t.marketValue > 0 ? t.fee / t.marketValue : 0,
  };
}

/** Spend aggregated per buying club, so a club that overpaid a little on six
 *  signings shows up next to one that overpaid hugely on a single striker. */
function byClub(paid: PricedTransfer[]): ClubPremium[] {
  const map = new Map<string, ClubPremium>();
  for (const t of paid) {
    const key = t.to.clubId || t.to.name;
    const entry = map.get(key) ?? {
      club: t.to,
      signings: 0,
      fees: 0,
      marketValue: 0,
      premium: 0,
      ratio: 0,
    };
    entry.signings += 1;
    entry.fees += t.fee;
    entry.marketValue += t.marketValue;
    entry.premium += t.premium;
    map.set(key, entry);
  }
  for (const entry of map.values()) {
    entry.ratio = entry.marketValue > 0 ? entry.fees / entry.marketValue : 0;
  }
  return [...map.values()].sort((a, b) => b.premium - a.premium);
}

export function analyzeTransfers(season: number, transfers: TopTransfer[]): FeeVsValueData {
  const loans = transfers.filter((t) => t.isLoan);
  const free = transfers.filter((t) => !t.isLoan && t.fee === 0);
  const paid = transfers.filter((t) => !t.isLoan && t.fee > 0 && t.marketValue > 0).map(price);

  const fees = paid.reduce((s, t) => s + t.fee, 0);
  const marketValue = paid.reduce((s, t) => s + t.marketValue, 0);

  return {
    season,
    paid,
    free,
    loans,
    totals: {
      fees,
      marketValue,
      premium: fees - marketValue,
      ratio: marketValue > 0 ? fees / marketValue : 0,
    },
    clubs: byClub(paid),
  };
}

/** Ranked slices the page reads off directly. Sorting once here keeps the four
 *  headline cards and the four leaderboards on the same source of truth. */
export function rank(paid: PricedTransfer[]) {
  const byPremium = [...paid].sort((a, b) => b.premium - a.premium);
  const byRatio = [...paid].sort((a, b) => b.ratio - a.ratio);
  return {
    overpaidAbsolute: byPremium,
    overpaidRatio: byRatio,
    underpaidAbsolute: [...byPremium].reverse(),
    underpaidRatio: [...byRatio].reverse(),
  };
}

// Plain per-request read, deduped with React cache. The JSON only changes via a
// data-refresh deploy, so an unstable_cache could only ever serve it stale.
export const getFeeVsValueData = cache(async (): Promise<FeeVsValueData> => {
  const raw = await readFile(join(process.cwd(), "data", "top-transfers.json"), "utf-8");
  const { season, transfers } = JSON.parse(raw) as { season: number; transfers: TopTransfer[] };
  return analyzeTransfers(season, transfers);
});
