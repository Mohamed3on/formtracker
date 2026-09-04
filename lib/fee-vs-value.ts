import type { TopTransfer, TransferClub } from "@/app/types";

/** Pure analysis, no filesystem and no cheerio: `Leaderboard` is a client
 *  component and calls `rank`/`withRanks` directly, so anything server-only in
 *  this module's graph would break the browser bundle. Fetching and caching live
 *  in lib/fetch-top-transfers.ts and lib/top-transfers.ts. */

/** A transfer with its fee-vs-market-value gap resolved. `premium` is the cash
 *  above (or below) what TM thought the player was worth; `ratio` is the same
 *  gap as a multiple, which is what separates a €10m overpay on a €5m player
 *  from a €10m overpay on a €100m one. */
export interface PricedTransfer extends TopTransfer {
  /** The valuation every measure on this page is taken against: what the player
   *  is worth **today** where the dataset has him, and the value frozen at the
   *  moment of the move otherwise.
   *
   *  One basis, used by `premium`, `ratio` and the club totals alike, so the
   *  figures on a row agree with each other: fee − worth is the cash gap and
   *  fee ÷ worth is the same gap as a multiple. Measuring the two against
   *  different values put `+€48.0M` beside `1.25×` on the same Morgan Rogers
   *  row, which reads as one of them being broken. */
  worth: number;
  /** Cash paid above (or below) `worth`. */
  premium: number;
  /** The same gap as a multiple: `1.00×` is the price the market now agrees
   *  with, `2.00×` is double what the player is worth. */
  ratio: number;
}

/**
 * Whether the market has moved on this player since he signed.
 *
 * `worth` is today's valuation where the committed dataset tracks him and the
 * frozen `marketValue` everywhere else, so the two differing *is* the fact —
 * there is nothing more to carry. A `currentValue` field used to say the same
 * thing a third time, present exactly when `worth !== marketValue` and equal to
 * `worth` whenever it was, which put a redundant number on the wire for every
 * row and left the concept itself unnamed.
 *
 * Transfermarkt re-rates a player towards the fee his new club paid — four of
 * this window's thirteen landed on the fee exactly — so a re-rated deal drifts
 * towards `1.00×` and a zero premium as the market comes round to the price.
 * That is the intended reading: these measure what he is worth now, not what the
 * buying club could have known. See lib/current-values.ts.
 */
export function revalued(t: PricedTransfer): boolean {
  return t.worth !== t.marketValue;
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
  /** Cash: paid on the way in, received on the way out. Every fee TM published,
   *  a loan fee included — a club that pays €4m to borrow a player has spent
   *  €4m. What it never includes is a fee TM didn't publish, which parses to 0
   *  and so adds nothing on its own. */
  fees: number;
  /** Summed `worth` of every move, loans and unpriced ones included: the whole
   *  squad that came in or went out, which is what `netValue` measures. */
  marketValue: number;
  /** Summed `worth` of the moves a fee can actually be held against — see
   *  `isPriced`. It is `premium`'s own denominator, so `pricedFees(side)` and
   *  this are the pair a club row's caption prints and the arithmetic adds up.
   *  Loaning a €50m player out is not selling him for nothing, so his value
   *  belongs in `marketValue` and nowhere near the premium. */
  pricedValue: number;
  premium: number;
  ratio: number;
  /** The moves themselves, dearest first, so a row can expand into the business
   *  behind its total. Free to hold by reference: club windows are derived on
   *  the client from the one transfer array, so nothing here crosses the wire. */
  transfers: PricedTransfer[];
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

/**
 * What the server ships: the window's transfers, priced, and nothing else.
 *
 * Every view the page offers — six rankings and two cuts of the club tables —
 * is a rearrangement of these same rows, so each one that was computed here
 * put the whole set on the wire again. They are derived on the client instead,
 * which costs a few hundred array operations and saves the duplication.
 */
export interface FeeVsValueData {
  season: number;
  transfers: PricedTransfer[];
}

/** `currentValue` is undefined for a player the dataset doesn't track, never
 *  zero — `getCurrentMarketValues` drops unvalued players rather than carrying
 *  them at nothing, which is what makes `??` the right fallback here. */
function price(t: TopTransfer, currentValue?: number): PricedTransfer {
  const worth = currentValue ?? t.marketValue;
  return {
    ...t,
    worth,
    premium: t.fee - worth,
    ratio: worth > 0 ? t.fee / worth : 0,
  };
}

const emptySide = (): ClubSide => ({
  players: 0,
  loans: 0,
  frees: 0,
  fees: 0,
  marketValue: 0,
  pricedValue: 0,
  premium: 0,
  ratio: 0,
  transfers: [],
});

/**
 * Every move counts towards the squad and towards the cash; only a move with a
 * price on it counts towards the comparison between them.
 *
 * `parseMarketValue` turns "loan transfer" and TM's "?" alike into a fee of 0,
 * which is harmless in a cash sum and ruinous in a premium: charging every row
 * fee minus worth reported the player's whole value as money lost on a number
 * TM never published, so a club that loaned four players out read as having
 * sold €130m of them for nothing.
 */
function addTo(side: ClubSide, t: PricedTransfer) {
  side.transfers.push(t);
  side.players += 1;
  if (t.isLoan) side.loans += 1;
  else if (t.isFree) side.frees += 1;
  side.marketValue += t.worth;
  side.fees += t.fee;
  if (isPriced(t)) {
    side.pricedValue += t.worth;
    side.premium += t.premium;
  }
}

/** What the priced moves actually cost — the fee half of the pair `premium`
 *  came from, which `fees` is not: `fees` also carries loan fees and any move
 *  with no value to compare against. Derived rather than stored, because
 *  `premium` already is `pricedFees - pricedValue`. */
export const pricedFees = (s: ClubSide) => s.pricedValue + s.premium;

function seal(side: ClubSide) {
  side.ratio = side.pricedValue > 0 ? pricedFees(side) / side.pricedValue : 0;
  // Best player first, not dearest deal first. An expanded club reads as
  // "what did they get", and each row shows worth → fee, so ordering on worth
  // runs down the left-hand column instead of the right — a €45m player bought
  // for €25m belongs above a €36m one, which is the whole point of the panel
  // he is sitting in.
  side.transfers.sort((a, b) => b.worth - a.worth || b.fee - a.fee);
}

/** Every club that touched the window, aggregated on both sides at once.
 *
 *  Every move counts towards what a squad gained or lost, loans and frees and
 *  the odd row TM lists no market value for included — a €50m striker arriving
 *  on loan is in the dressing room, which is the single best answer a window
 *  can give. Only the priced ones count towards what it cost; see `addTo`.
 *
 *  That split is why there is no loans-off cut of this: the two questions a cut
 *  used to separate are answered by different fields of the same window. */
export function buildClubWindows(transfers: PricedTransfer[]): ClubWindow[] {
  const map = new Map<string, ClubWindow>();
  const at = (club: TransferClub) => {
    const key = club.clubId || club.name;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        club,
        in: emptySide(),
        out: emptySide(),
        netValue: 0,
        netSpend: 0,
      };
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

export function analyzeTransfers(
  season: number,
  transfers: TopTransfer[],
  currentValues: ReadonlyMap<string, number> = new Map(),
): FeeVsValueData {
  return {
    season,
    transfers: transfers.map((t) => price(t, currentValues.get(t.playerId))),
  };
}

/**
 * A move this page can put a price on — the one pool every ranking and the
 * shared bar axis are drawn from.
 *
 * Three ways a row falls out. A loan is not a signing at all: TM lists no fee
 * for one and ranks it by its own internal transfer value. A market value of
 * zero can't be compared against anything, and would divide by zero on the way
 * to a ratio. And a move TM published no fee for parses to a fee of zero exactly
 * like a free transfer does — ranking it would report the player's whole value
 * as money saved, on a number TM never published.
 *
 * Stated once because it was previously spelled out at each site, and the copies
 * drifted: `rank` learned to exclude unpriced moves and end-of-loan returns
 * while the window headline went on counting both as signings bought for
 * nothing. That headline is gone now, but the lesson it cost is why this is a
 * named predicate rather than a condition written out wherever it is needed.
 *
 * The club totals use it for their money half only: a loan still tells you what
 * a squad gained or lost, so it counts towards `marketValue` while staying out
 * of `fees` and `premium` — see `addTo`.
 */
export function isPriced(t: PricedTransfer): boolean {
  return !t.isLoan && t.worth > 0 && (t.fee > 0 || t.isFree);
}

/**
 * The ranked slices the page reads off, sorted once so the leaderboards all
 * share one source of truth.
 *
 * Which list a transfer is eligible for follows from what the buying club
 * actually did. A free transfer is still a permanent signing, so it belongs in
 * the cash rankings — picking up a €45m defender for nothing is the biggest
 * bargain a window can hold. It has no place in the times-value rankings: every
 * free divides out to 0.00×, so they would fill the top of that list in a dead
 * heat and bury the deals where a club actually negotiated a price down. A loan
 * is not a signing at all — TM lists no fee for one and ranks it by its own
 * internal transfer value — so it stays out of both, and out of the plain
 * biggest-fee and most-valuable lists with them.
 */
export function rank(transfers: PricedTransfer[]) {
  const permanent = transfers.filter(isPriced);
  const paid = permanent.filter((t) => t.fee > 0);

  // Each measure breaks its own ties on the other one, so two deals the same
  // distance from value are ordered by which was the more extreme in the way
  // this list isn't measuring — and the display order stops depending on which
  // happened to be scraped first. Reversing gives the ascending list, secondary
  // key included, which is the right direction for a bargain too: of two deals
  // equally under value, the lower multiple is the better piece of business.
  const byPremium = [...permanent].sort((a, b) => b.premium - a.premium || b.ratio - a.ratio);
  const byRatio = [...paid].sort((a, b) => b.ratio - a.ratio || b.premium - a.premium);

  return {
    overpaidAbsolute: byPremium,
    overpaidRatio: byRatio,
    underpaidAbsolute: [...byPremium].reverse(),
    underpaidRatio: [...byRatio].reverse(),
    // Plain "who cost the most" and "who was worth the most" — no judgement
    // about the price, so every permanent move is eligible.
    byFee: [...permanent].sort((a, b) => b.fee - a.fee || b.worth - a.worth),
    byValue: [...permanent].sort((a, b) => b.worth - a.worth || b.fee - a.fee),
  };
}

/**
 * Competition ranking (1, 2, 2, 4) so tied deals share a number instead of one
 * arbitrarily sitting above the other — both €20m-under-value deals of a window
 * are the joint biggest bargain.
 *
 * Ties are decided on the figure the row actually shows, not the raw number
 * behind it: two rows both reading "+€52.7M" are a dead heat to the reader, and
 * ranking one above the other on a difference they cannot see is noise. (Float
 * noise is not the reason — IEEE division is correctly rounded, so equal ratios
 * built from representable euro figures come out bit-identical.)
 */
export function withRanks(
  sorted: PricedTransfer[],
  format: (t: PricedTransfer) => string,
): Array<{ transfer: PricedTransfer; rank: number }> {
  let lastShown: string | null = null;
  let lastRank = 0;
  return sorted.map((transfer, i) => {
    const shown = format(transfer);
    if (shown !== lastShown) {
      lastRank = i + 1;
      lastShown = shown;
    }
    return { transfer, rank: lastRank };
  });
}

/**
 * A stable identity for one move.
 *
 * `playerId` alone is not unique: eight players in this window moved twice
 * (Openda went Leipzig → Juventus → Lyon, both moves permanent), so keying a
 * list on it hands React the same key twice and lets the virtualiser reuse the
 * wrong row when the list reorders. TM's own `rank` is unique per row, which is
 * the one thing it is good for.
 */
export function transferKey(t: TopTransfer): string {
  return `${t.rank}-${t.playerId}`;
}

/**
 * The euro axis every **player row** is drawn against: zero to the largest
 * figure any one priced deal puts on it.
 *
 * One scale across all six rankings, not one per list, so a bar means the same
 * thing wherever a row appears and switching tabs reorders the rows without
 * redrawing the ruler under them. It is also what makes the page's hardest idea
 * visible for free: the cash lists lead with long bars and the times-value lists
 * lead with short ones, which is precisely why the two rarely name the same
 * player.
 *
 * The club tables and the window headline draw their own rulers, an order of
 * magnitude up — a club's whole window against one signing would flatten every
 * player row to nothing.
 *
 * Measured over `isPriced` rows only: a move that cannot appear on any list must
 * not stretch the ruler for the ones that can.
 */
export function gapScale(transfers: PricedTransfer[]): number {
  let max = 0;
  for (const t of transfers) {
    if (!isPriced(t)) continue;
    max = Math.max(max, t.fee, t.worth, t.marketValue);
  }
  return max;
}

/**
 * Where one deal's figures fall on that axis, as percentages of its width.
 *
 * The bar is anchored on `worth` because that is the basis both of the figures
 * a row prints are measured from — a bar drawn from anything else would
 * contradict the numbers beside it. A deal the market has come round to has its
 * fee and its worth in the same place, and so has no bar at all.
 *
 * A `PricedTransfer` satisfies this shape as it stands, so a row passes itself
 * and gets the third mark — what the player was valued at on the day he moved —
 * wherever `revalued` would be true. Club and window bars pass the two figures
 * alone: an aggregate has no frozen value to mark.
 */
export function barGeometry(
  d: { worth: number; fee: number; marketValue?: number },
  axisMax: number,
): { worthPct: number; feePct: number; wasPct: number | null } {
  const pct = (n: number) => (axisMax > 0 ? Math.min(100, Math.max(0, (n / axisMax) * 100)) : 0);
  return {
    worthPct: pct(d.worth),
    feePct: pct(d.fee),
    // The same test `revalued` makes: the frozen value earns a mark only where
    // it says something `worth` doesn't.
    wasPct: d.marketValue !== undefined && d.marketValue !== d.worth ? pct(d.marketValue) : null,
  };
}
