import type { TopTransfer, TransferClub } from "@/app/types";

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
  /** Both cuts of the club tables, so the page can offer the choice without a
   *  second pass on the client: a loan flatters a club's numbers (a €60m player
   *  for a €3m fee, or none at all) and whether that counts as good business is
   *  a matter of taste, not of fact. */
  clubs: { withLoans: ClubWindow[]; permanentOnly: ClubWindow[] };
}

/** One club's side of a window — everything it bought, or everything it sold.
 *
 *  `premium` reads in opposite directions on the two sides, which is the whole
 *  point of keeping them apart: buying above a player's value is money wasted,
 *  selling above it is money made. */
export interface ClubSide {
  players: number;
  /** TM lists a fee for some loans ("Loan fee:€3.00m") and none for others, so
   *  this can't be read off the fee — a €3m loan of a €60m player is a loan. */
  loans: number;
  /** Permanent moves that cost nothing. */
  frees: number;
  /** Paid, on the way in; received, on the way out. */
  fees: number;
  marketValue: number;
  premium: number;
  ratio: number;
  /** The moves themselves, dearest first, so a row can expand into the business
   *  behind its total. Same objects the ranked lists hold, so this costs a
   *  back-reference rather than a second copy on the wire. */
  transfers: TopTransfer[];
}

/** A club's whole window: what came in, what went out, and the two nets that
 *  fall out of them. A club can appear having only bought or only sold. */
export interface ClubWindow {
  club: TransferClub;
  in: ClubSide;
  out: ClubSide;
  /** Market value gained minus lost — who actually strengthened. */
  netValue: number;
  /** Fees paid minus received — who actually spent. */
  netSpend: number;
}

function price(t: TopTransfer): PricedTransfer {
  return {
    ...t,
    premium: t.fee - t.marketValue,
    ratio: t.marketValue > 0 ? t.fee / t.marketValue : 0,
  };
}

const emptySide = (): ClubSide => ({
  players: 0,
  loans: 0,
  frees: 0,
  fees: 0,
  marketValue: 0,
  premium: 0,
  ratio: 0,
  transfers: [],
});

function addTo(side: ClubSide, t: TopTransfer) {
  side.transfers.push(t);
  side.players += 1;
  if (t.isLoan) side.loans += 1;
  else if (t.fee === 0) side.frees += 1;
  side.fees += t.fee;
  side.marketValue += t.marketValue;
  side.premium += t.fee - t.marketValue;
}

function seal(side: ClubSide) {
  side.ratio = side.marketValue > 0 ? side.fees / side.marketValue : 0;
  side.transfers.sort((a, b) => b.fee - a.fee || b.marketValue - a.marketValue);
}

/** Every club that touched the window, aggregated on both sides at once.
 *
 *  Unlike the player rankings this counts loans and frees. There the question is
 *  "was this deal priced well", which a move with no fee cannot answer; here it
 *  is "what did the club end up with, and what did it cost" — and a €50m striker
 *  arriving on loan for nothing is the single best answer a window can give. */
function buildClubWindows(transfers: TopTransfer[]): ClubWindow[] {
  const map = new Map<string, ClubWindow>();
  const at = (club: TransferClub) => {
    const key = club.clubId || club.name;
    let entry = map.get(key);
    if (!entry) {
      entry = { club, in: emptySide(), out: emptySide(), netValue: 0, netSpend: 0 };
      map.set(key, entry);
    }
    return entry;
  };

  for (const t of transfers) {
    if (t.to.name) addTo(at(t.to).in, t);
    // TM leaves the selling club blank on the odd row (a released player, a club
    // it has no page for); those rows still count as an arrival, just not as
    // anyone's sale.
    if (t.from.name) addTo(at(t.from).out, t);
  }

  const windows = [...map.values()];
  for (const w of windows) {
    seal(w.in);
    seal(w.out);
    w.netValue = w.in.marketValue - w.out.marketValue;
    w.netSpend = w.in.fees - w.out.fees;
  }
  return windows;
}

export function analyzeTransfers(season: number, transfers: TopTransfer[]): FeeVsValueData {
  // A market value of zero can't be compared against anything, and would divide
  // by zero on the way to a ratio.
  const valued = transfers.filter((t) => t.marketValue > 0);
  const loans = valued.filter((t) => t.isLoan);
  const free = valued.filter((t) => !t.isLoan && t.fee === 0).map(price);
  const paid = valued.filter((t) => !t.isLoan && t.fee > 0).map(price);

  return {
    season,
    paid,
    free,
    loans,
    clubs: {
      withLoans: buildClubWindows([...paid, ...free, ...loans]),
      permanentOnly: buildClubWindows([...paid, ...free]),
    },
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

/** Competition ranking (1, 2, 2, 4) so tied deals share a number instead of one
 *  arbitrarily sitting above the other — both €20m-under-value deals of a window
 *  are the joint biggest bargain.
 *
 *  Rounded to the cent before comparing: these are euro figures reconstructed
 *  from "€35.00m" strings, and float division leaves two genuinely equal ratios
 *  differing in the fifteenth decimal. */
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
