import { describe, expect, it } from "vitest";
import {
  analyzeTransfers,
  barGeometry,
  buildClubWindows,
  gapScale,
  rank,
  summarize,
  transferKey,
  withRanks,
  type PricedTransfer,
} from "./fee-vs-value";
import { formatPremium, formatRatio } from "./format";
import type { TopTransfer } from "@/app/types";

const club = (name: string) => ({
  name,
  clubId: name,
  logoUrl: "",
  league: "Premier League",
  country: "England",
});

const tx = (over: Partial<TopTransfer> & Pick<TopTransfer, "name">): TopTransfer => ({
  rank: 1,
  playerId: over.name,
  position: "Centre-Forward",
  age: 24,
  imageUrl: "",
  nationality: "England",
  nationalityFlagUrl: "",
  marketValue: 10_000_000,
  fee: 10_000_000,
  feeText: "€10.00m",
  isLoan: false,
  isFree: false,
  from: club("Seller"),
  to: club("Buyer"),
  ...over,
});

const names = (list: PricedTransfer[]) => list.map((t) => t.name);

describe("analyzeTransfers", () => {
  const data = analyzeTransfers(2026, [
    tx({ name: "Overpay", marketValue: 10_000_000, fee: 30_000_000 }),
    tx({ name: "Bargain", marketValue: 40_000_000, fee: 20_000_000, to: club("Thrifty") }),
    tx({
      name: "Freebie",
      marketValue: 45_000_000,
      fee: 0,
      feeText: "free transfer",
      isFree: true,
      to: club("Gifted"),
    }),
    tx({
      name: "Loanee",
      marketValue: 50_000_000,
      fee: 0,
      feeText: "loan transfer",
      isLoan: true,
      to: club("Gifted"),
    }),
  ]);

  it("keeps every transfer in one array, priced", () => {
    expect(names(data.transfers)).toEqual(["Overpay", "Bargain", "Freebie", "Loanee"]);
  });

  it("computes premium and ratio per transfer", () => {
    const [overpay, bargain] = data.transfers;
    expect(overpay.premium).toBe(20_000_000);
    expect(overpay.ratio).toBe(3);
    expect(bargain.premium).toBe(-20_000_000);
    expect(bargain.ratio).toBe(0.5);
  });

  it("prices a free transfer as its whole value saved", () => {
    const freebie = data.transfers.find((t) => t.name === "Freebie")!;
    expect(freebie.premium).toBe(-45_000_000);
    expect(freebie.ratio).toBe(0);
  });

  const withLoans = buildClubWindows(data.transfers);
  const permanentOnly = buildClubWindows(data.transfers, (t) => !t.isLoan);
  const window = (name: string, cut = withLoans) => cut.find((c) => c.club.name === name)!;

  it("orders a club's moves by the player, not by the fee", () => {
    // A dearer player on a smaller fee outranks a cheaper one on a bigger fee.
    const { transfers } = analyzeTransfers(2026, [
      tx({ name: "Pricier", marketValue: 32_000_000, fee: 36_000_000, to: club("Roma") }),
      tx({ name: "Better", marketValue: 45_000_000, fee: 25_000_000, to: club("Roma") }),
    ]);
    const roma = buildClubWindows(transfers).find((c) => c.club.name === "Roma")!;
    expect(names(roma.in.transfers)).toEqual(["Better", "Pricier"]);
  });

  it("counts loans and frees towards their club, unlike the player rankings", () => {
    expect(
      withLoans
        .filter((c) => c.in.players > 0)
        .map((c) => [c.club.name, c.in.players, c.in.loans, c.in.frees, c.in.premium]),
    ).toEqual([
      ["Buyer", 1, 0, 0, 20_000_000],
      ["Thrifty", 1, 0, 0, -20_000_000],
      // Freebie and Loanee arrived for nothing and still show up as a club's business.
      ["Gifted", 2, 1, 1, -95_000_000],
    ]);
  });

  it("offers a loan-free cut of the same table", () => {
    expect(
      permanentOnly
        .filter((c) => c.in.players > 0)
        .map((c) => [c.club.name, c.in.players, c.in.loans, c.in.premium]),
    ).toEqual([
      ["Buyer", 1, 0, 20_000_000],
      ["Thrifty", 1, 0, -20_000_000],
      // Only Freebie survives, so Gifted drops from -95m to -45m.
      ["Gifted", 1, 0, -45_000_000],
    ]);
  });

  it("aggregates the selling side off the same rows", () => {
    // Every fixture move leaves the same club, so Seller is the counterparty to
    // all four: 10 + 40 + 45 + 50 of value out, for 30 + 20 + 0 + 0 in fees.
    const seller = window("Seller");
    expect(seller.out.players).toBe(4);
    expect(seller.out.marketValue).toBe(145_000_000);
    expect(seller.out.fees).toBe(50_000_000);
    // Negative on the way out means sold below what the players were worth.
    expect(seller.out.premium).toBe(-95_000_000);
    expect(seller.in.players).toBe(0);
  });

  it("nets value and spend across both sides", () => {
    const seller = window("Seller");
    expect(seller.netValue).toBe(-145_000_000);
    expect(seller.netSpend).toBe(-50_000_000);
    expect(window("Buyer").netValue).toBe(10_000_000);
    expect(window("Buyer").netSpend).toBe(30_000_000);
  });

  it("holds a club's moves by reference, best player first", () => {
    const moves = window("Gifted").in.transfers;
    // Ordered on what the club got (50m then 45m), not on what it paid — both
    // arrived for nothing.
    expect(names(moves)).toEqual(["Loanee", "Freebie"]);
    // The same objects the rankings hold, not copies of them.
    expect(moves[0]).toBe(data.transfers[3]);
  });
});

describe("rank", () => {
  const data = analyzeTransfers(2026, [
    tx({ name: "Overpay", marketValue: 10_000_000, fee: 30_000_000 }),
    tx({ name: "Bargain", marketValue: 40_000_000, fee: 20_000_000 }),
    tx({
      name: "Freebie",
      marketValue: 45_000_000,
      fee: 0,
      feeText: "free transfer",
      isFree: true,
    }),
    tx({ name: "Loanee", marketValue: 50_000_000, fee: 0, feeText: "loan", isLoan: true }),
  ]);
  const r = rank(data.transfers);

  it("ranks frees on cash but never on times value", () => {
    // A free is a permanent signing, so it is the biggest bargain in cash…
    expect(names(r.underpaidAbsolute)).toEqual(["Freebie", "Bargain", "Overpay"]);
    // …but every free is 0.00×, which would fill the ratio list in a dead heat.
    expect(names(r.underpaidRatio)).toEqual(["Bargain", "Overpay"]);
  });

  it("keeps loans out of every list — a loan is not a signing", () => {
    for (const list of Object.values(r)) expect(names(list)).not.toContain("Loanee");
  });

  it("ranks both directions off one sort", () => {
    expect(r.overpaidAbsolute[0].name).toBe("Overpay");
    expect(r.underpaidAbsolute[0].name).toBe("Freebie");
    expect(r.overpaidRatio[0].name).toBe("Overpay");
    expect(r.underpaidRatio[0].name).toBe("Bargain");
  });

  it("ranks the plain biggest lists over permanent moves only", () => {
    expect(names(r.byFee)).toEqual(["Overpay", "Bargain", "Freebie"]);
    expect(names(r.byValue)).toEqual(["Freebie", "Bargain", "Overpay"]);
  });

  it("drops a transfer with no market value rather than dividing by zero", () => {
    const unvalued = analyzeTransfers(2026, [
      tx({ name: "Unvalued", marketValue: 0, fee: 5_000_000 }),
      tx({ name: "UnvaluedFree", marketValue: 0, fee: 0, feeText: "free transfer", isFree: true }),
    ]);
    for (const list of Object.values(rank(unvalued.transfers))) expect(list).toEqual([]);
  });

  it("still counts an unvalued move towards its club's business", () => {
    // The zero-value guard exists for ratio division, which club totals never do:
    // a club still paid the fee and still ended up with the player.
    const unvalued = analyzeTransfers(2026, [
      tx({ name: "Unvalued", marketValue: 0, fee: 5_000_000, to: club("Buyer") }),
    ]);
    expect(
      buildClubWindows(unvalued.transfers).find((c) => c.club.name === "Buyer")!.in,
    ).toMatchObject({
      players: 1,
      fees: 5_000_000,
    });
  });
});

describe("withRanks", () => {
  // Two deals €20m under value: joint biggest bargain, however they happen to sort.
  const tied = analyzeTransfers(2026, [
    tx({ name: "Khannouss", marketValue: 35_000_000, fee: 15_000_000 }),
    tx({ name: "Malen", marketValue: 45_000_000, fee: 25_000_000 }),
    tx({ name: "Solo", marketValue: 30_000_000, fee: 25_000_000 }),
  ]);
  const r = rank(tied.transfers);
  const ranks = (list: PricedTransfer[], format: (t: PricedTransfer) => string) =>
    withRanks(list, format).map((e) => [e.transfer.name, e.rank]);

  it("separates the same pair when the measure does distinguish them", () => {
    expect(ranks(r.underpaidRatio, (t) => formatRatio(t.ratio))).toEqual([
      ["Khannouss", 1],
      ["Malen", 2],
      ["Solo", 3],
    ]);
  });

  it("gives tied deals the same rank and skips the next", () => {
    expect(ranks(r.underpaidAbsolute, (t) => formatPremium(t.premium))).toEqual([
      ["Khannouss", 1],
      ["Malen", 1],
      ["Solo", 3],
    ]);
  });

  it("ties on the figure the row shows, not the number behind it", () => {
    // 1.6667× and 1.6673× both render "1.67×". Ranking one above the other on a
    // difference the reader cannot see is noise, so they share the rank.
    const near = analyzeTransfers(2026, [
      tx({ name: "Shown", marketValue: 30_000_000, fee: 50_000_000 }),
      tx({ name: "AlsoShown", marketValue: 30_000_000, fee: 50_020_000 }),
    ]);
    const list = rank(near.transfers).overpaidRatio;
    expect(list[0].ratio).not.toBe(list[1].ratio);
    expect(list.map((t) => formatRatio(t.ratio))).toEqual(["1.67×", "1.67×"]);
    expect(ranks(list, (t) => formatRatio(t.ratio))).toEqual([
      ["AlsoShown", 1],
      ["Shown", 1],
    ]);
  });
});

describe("current market value", () => {
  const now = new Map([
    ["Rerated", 110_000_000],
    ["Unchanged", 40_000_000],
  ]);
  const [rerated, unchanged, untracked] = analyzeTransfers(
    2026,
    [
      tx({ name: "Rerated", marketValue: 90_000_000, fee: 138_000_000 }),
      tx({ name: "Unchanged", marketValue: 40_000_000, fee: 60_000_000 }),
      tx({ name: "Untracked", marketValue: 50_000_000, fee: 75_000_000 }),
    ],
    now,
  ).transfers;

  it("measures the multiple against what the player is worth now", () => {
    // €138m against today's €110m, not against the €90m frozen at the move.
    expect(rerated.currentValue).toBe(110_000_000);
    expect(rerated.ratio).toBeCloseTo(138 / 110, 10);
  });

  it("puts the cash premium on the same basis as the multiple", () => {
    // €138m against today's €110m. Measuring cash against the frozen €90m would
    // print "+€48.0M" beside "1.25×" and read as one of them being broken.
    expect(rerated.premium).toBe(28_000_000);
    expect(rerated.worth).toBe(110_000_000);
    expect(rerated.premium).toBe(rerated.fee - rerated.worth);
  });

  it("lands a re-rated deal on zero premium once the market agrees with the fee", () => {
    const [gordon] = analyzeTransfers(
      2026,
      [tx({ name: "Gordon", marketValue: 65_000_000, fee: 80_000_000 })],
      new Map([["Gordon", 80_000_000]]),
    ).transfers;
    expect(gordon.premium).toBe(0);
    expect(gordon.ratio).toBe(1);
  });

  it("falls back to the frozen value for a player the dataset doesn't track", () => {
    expect(untracked.currentValue).toBeUndefined();
    expect(untracked.worth).toBe(untracked.marketValue);
    expect(untracked.ratio).toBe(1.5);
    expect(untracked.premium).toBe(25_000_000);
  });

  it("carries no current value when the market hasn't moved him", () => {
    // Nothing to say, and nothing to put on the wire.
    expect(unchanged.currentValue).toBeUndefined();
    expect(unchanged.ratio).toBe(1.5);
  });
});

describe("transferKey", () => {
  it("separates two moves by the same player in one window", () => {
    // Openda went Leipzig → Juventus → Lyon; the player id alone collides.
    const [first, second] = analyzeTransfers(2026, [
      tx({ name: "Openda", rank: 12, from: club("Leipzig"), to: club("Juventus") }),
      tx({ name: "Openda", rank: 44, from: club("Juventus"), to: club("Lyon") }),
    ]).transfers;
    expect(first.playerId).toBe(second.playerId);
    expect(transferKey(first)).not.toBe(transferKey(second));
  });
});

describe("summarize", () => {
  const summary = summarize(
    analyzeTransfers(
      2026,
      [
        tx({ name: "Overpay", marketValue: 10_000_000, fee: 30_000_000 }),
        tx({ name: "Bargain", marketValue: 40_000_000, fee: 20_000_000 }),
        tx({ name: "Exact", marketValue: 25_000_000, fee: 25_000_000 }),
        tx({
          name: "Freebie",
          marketValue: 45_000_000,
          fee: 0,
          feeText: "free transfer",
          isFree: true,
        }),
        tx({ name: "Loanee", marketValue: 50_000_000, fee: 0, isLoan: true }),
        tx({ name: "Unpriced", marketValue: 0, fee: 9_000_000 }),
      ],
      new Map([["Overpay", 28_000_000]]),
    ).transfers,
  );

  it("totals only the deals the rankings can price", () => {
    // The loan and the row TM gave no value for are both out of the pool.
    expect(summary.deals).toBe(4);
    expect(summary.fees).toBe(75_000_000);
    // Totalled on `worth`, so Overpay counts at today's €28m rather than the
    // €10m frozen at his move: 28 + 40 + 25 + 45.
    expect(summary.marketValue).toBe(138_000_000);
    expect(summary.premium).toBe(summary.fees - summary.marketValue);
    expect(summary.ratio).toBeCloseTo(75 / 138, 10);
  });

  it("splits the deals around their own valuations", () => {
    expect([summary.over, summary.level, summary.under]).toEqual([1, 1, 2]);
  });

  it("accounts for what it left out rather than dropping it silently", () => {
    expect(summary.loans).toBe(1);
    expect(summary.frees).toBe(1);
  });

  it("counts the market's later verdict", () => {
    // €28m today against €10m at the move, still short of the €30m fee.
    expect(summary.revalued).toBe(1);
    expect(summary.revaluedUp).toBe(1);
    expect(summary.worthTheFee).toBe(0);
  });
});

describe("the fee-vs-value bar", () => {
  const transfers = analyzeTransfers(2026, [
    tx({ name: "Big", marketValue: 90_000_000, fee: 100_000_000 }),
    tx({ name: "Small", marketValue: 5_000_000, fee: 20_000_000 }),
    tx({ name: "Loanee", marketValue: 200_000_000, fee: 0, isLoan: true }),
  ]).transfers;

  it("scales to the largest figure any priced deal puts on the axis", () => {
    // A loan is not a signing, so it must not stretch the ruler for everyone.
    expect(gapScale(transfers)).toBe(100_000_000);
  });

  it("places both figures of a deal on that one shared axis", () => {
    const t = transfers[0];
    expect(barGeometry({ worth: t.worth, fee: t.fee }, 100_000_000)).toEqual({
      worthPct: 90,
      feePct: 100,
      wasPct: null,
    });
  });

  it("keeps a small deal small, which is what the times-value lists show", () => {
    const t = transfers[1];
    const geo = barGeometry({ worth: t.worth, fee: t.fee }, 100_000_000);
    expect(geo.worthPct).toBe(5);
    expect(geo.feePct).toBe(20);
  });

  it("anchors the bar on worth, and marks the value at the move beside it", () => {
    const [rerated] = analyzeTransfers(
      2026,
      [tx({ name: "Rerated", marketValue: 90_000_000, fee: 138_000_000 })],
      new Map([["Rerated", 110_000_000]]),
    ).transfers;
    const geo = barGeometry(
      { worth: rerated.worth, fee: rerated.fee, wasWorth: rerated.marketValue },
      138_000_000,
    );
    // The bar runs from today's €110m to the €138m fee — the same €28m the row
    // prints — with the €90m he was worth on the day marked behind it.
    expect(geo.worthPct).toBeCloseTo((110 / 138) * 100, 10);
    expect(geo.feePct).toBe(100);
    expect(geo.wasPct).toBeCloseTo((90 / 138) * 100, 10);
  });

  it("collapses to no bar when the market has come round to the fee", () => {
    const [caught] = analyzeTransfers(
      2026,
      [tx({ name: "Gordon", marketValue: 65_000_000, fee: 80_000_000 })],
      new Map([["Gordon", 80_000_000]]),
    ).transfers;
    expect(caught.premium).toBe(0);
    const geo = barGeometry({ worth: caught.worth, fee: caught.fee }, 100_000_000);
    expect(geo.worthPct).toBe(geo.feePct);
  });
});

describe("unpriced moves", () => {
  // TM prints "?" or "-" for a permanent move whose fee it never learned. That
  // parses to 0 exactly like a free transfer does.
  const data = analyzeTransfers(2026, [
    tx({ name: "Unpriced", marketValue: 40_000_000, fee: 0, feeText: "?" }),
    tx({
      name: "Freebie",
      marketValue: 40_000_000,
      fee: 0,
      feeText: "free transfer",
      isFree: true,
    }),
  ]);

  it("keeps a move with no published fee out of the rankings", () => {
    // Ranking it would report €40m of value as money the club saved, on a
    // number Transfermarkt never published.
    const r = rank(data.transfers);
    expect(names(r.underpaidAbsolute)).toEqual(["Freebie"]);
    expect(names(r.byFee)).toEqual(["Freebie"]);
  });

  it("does not count it as a free transfer in a club's business", () => {
    const clubs = buildClubWindows(data.transfers);
    const buyer = clubs.find((c) => c.club.name === "Buyer")!;
    expect(buyer.in.players).toBe(2);
    expect(buyer.in.frees).toBe(1);
  });
});
