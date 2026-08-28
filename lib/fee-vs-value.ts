import type { TopTransfer } from "@/app/types";

/** Pure analysis, no filesystem: `Leaderboard` is a client component and needs
 *  `withRanks`, so a `node:fs` import anywhere in this module's graph would
 *  break the browser bundle. Reading data/top-transfers.json lives in
 *  lib/top-transfers.ts, which only server components touch. */

/** A transfer with its fee-vs-market-value gap resolved. `premium` is the cash
 *  above (or below) what TM thought the player was worth; `ratio` is the same
 *  gap as a multiple, which is what separates a €10m overpay on a €5m player
 *  from a €10m overpay on a €100m one. */
export interface PricedTransfer extends TopTransfer {
  premium: number;
  ratio: number;
}

/** Transfers split by what the buying club actually did.
 *
 *  A free transfer is still a permanent signing, so it belongs in the cash
 *  rankings — picking up a €45m defender for nothing is the biggest bargain a
 *  window can hold. It has no place in the times-value rankings: every free
 *  divides out to 0.00×, so they would fill the top of that list in a dead heat
 *  and bury the deals where a club actually negotiated a price down.
 *
 *  A loan is not a signing at all — TM lists no fee for one and ranks it by its
 *  own internal transfer value — so it stays out of both. */
export interface FeeVsValueData {
  season: number;
  /** Permanent signings that cost a fee: ranked on cash and on times value. */
  paid: PricedTransfer[];
  /** Permanent signings that cost nothing: ranked on cash only. */
  free: PricedTransfer[];
  loans: TopTransfer[];
  totals: { fees: number; marketValue: number; premium: number; ratio: number };
  clubs: ClubPremium[];
}

export interface ClubPremium {
  club: TopTransfer["to"];
  /** Every arrival counted, fee or not. */
  signings: number;
  /** Of those, the ones that were loans. TM lists a fee for some of these
   *  ("Loan fee:€3.00m") and none for others, so this can't be read off the
   *  fee — a €3m loan of a €60m player is still a loan, not a signing. */
  loans: number;
  /** Of those, the permanent ones that cost nothing. */
  frees: number;
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
 *  signings shows up next to one that overpaid hugely on a single striker.
 *
 *  Unlike the player rankings this counts loans and frees. There the question is
 *  "was this deal priced well", which a move with no fee cannot answer; here it
 *  is "what did the club end up with, and what did it cost" — and a €50m striker
 *  arriving on loan for nothing is the single best answer a window can give. */
function byClub(arrivals: TopTransfer[]): ClubPremium[] {
  const map = new Map<string, ClubPremium>();
  for (const t of arrivals) {
    const key = t.to.clubId || t.to.name;
    const entry = map.get(key) ?? {
      club: t.to,
      signings: 0,
      loans: 0,
      frees: 0,
      fees: 0,
      marketValue: 0,
      premium: 0,
      ratio: 0,
    };
    entry.signings += 1;
    if (t.isLoan) entry.loans += 1;
    else if (t.fee === 0) entry.frees += 1;
    entry.fees += t.fee;
    entry.marketValue += t.marketValue;
    entry.premium += t.fee - t.marketValue;
    map.set(key, entry);
  }
  for (const entry of map.values()) {
    entry.ratio = entry.marketValue > 0 ? entry.fees / entry.marketValue : 0;
  }
  return [...map.values()].sort((a, b) => b.premium - a.premium);
}

export function analyzeTransfers(season: number, transfers: TopTransfer[]): FeeVsValueData {
  // A market value of zero can't be compared against anything, and would divide
  // by zero on the way to a ratio.
  const valued = transfers.filter((t) => t.marketValue > 0);
  const loans = valued.filter((t) => t.isLoan);
  const free = valued.filter((t) => !t.isLoan && t.fee === 0).map(price);
  const paid = valued.filter((t) => !t.isLoan && t.fee > 0).map(price);

  // Totals cover every permanent move, frees included: a club that paid nothing
  // still added that value to its squad, and leaving it out would overstate what
  // the market paid per euro of player.
  const permanent = [...paid, ...free];
  const fees = permanent.reduce((s, t) => s + t.fee, 0);
  const marketValue = permanent.reduce((s, t) => s + t.marketValue, 0);

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
    clubs: byClub([...paid, ...free, ...loans]),
  };
}

/** Ranked slices the page reads off directly. Sorting once here keeps the
 *  headline cards and the leaderboards on the same source of truth. */
export function rank(paid: PricedTransfer[], free: PricedTransfer[] = []) {
  // Cash ranks every permanent move; times value ranks only the ones with a fee.
  // Each measure breaks its own ties on the other one, so two deals the same
  // distance from value are ordered by which was the more extreme in the way
  // this list isn't measuring — and the display order stops depending on which
  // happened to be scraped first.
  const byPremium = [...paid, ...free].sort((a, b) => b.premium - a.premium || b.ratio - a.ratio);
  const byRatio = [...paid].sort((a, b) => b.ratio - a.ratio || b.premium - a.premium);
  // Plain "who cost the most" and "who was worth the most" — no judgement about
  // the price, so every permanent move is eligible, same pool as the cash lists.
  const permanent = [...paid, ...free];
  return {
    overpaidAbsolute: byPremium,
    overpaidRatio: byRatio,
    underpaidAbsolute: [...byPremium].reverse(),
    underpaidRatio: [...byRatio].reverse(),
    byFee: [...permanent].sort((a, b) => b.fee - a.fee || b.marketValue - a.marketValue),
    byValue: [...permanent].sort((a, b) => b.marketValue - a.marketValue || b.fee - a.fee),
  };
}

/** Both €20m-under-value deals of a window are the joint biggest bargain, so
 *  every leader is a list. Rounded to the cent before comparing — these are
 *  euro figures reconstructed from "€35.00m" strings, and float division leaves
 *  two genuinely equal ratios differing in the fifteenth decimal. */
export function leaders(
  sorted: PricedTransfer[],
  measure: (t: PricedTransfer) => number,
): PricedTransfer[] {
  if (!sorted.length) return [];
  const best = Math.round(measure(sorted[0]) * 100);
  return sorted.filter((t) => Math.round(measure(t) * 100) === best);
}

/** Competition ranking (1, 2, 2, 4) so tied deals share a number instead of one
 *  arbitrarily sitting above the other. */
export function withRanks(
  sorted: PricedTransfer[],
  measure: (t: PricedTransfer) => number,
): Array<{ transfer: PricedTransfer; rank: number }> {
  let lastValue: number | null = null;
  let lastRank = 0;
  return sorted.map((transfer, i) => {
    const value = Math.round(measure(transfer) * 100);
    if (value !== lastValue) {
      lastRank = i + 1;
      lastValue = value;
    }
    return { transfer, rank: lastRank };
  });
}
