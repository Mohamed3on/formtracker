import { describe, expect, it } from "vitest";
import { analyzeTransfers, rank, withRanks } from "./fee-vs-value";
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
  from: club("Seller"),
  to: club("Buyer"),
  ...over,
});

describe("analyzeTransfers", () => {
  const data = analyzeTransfers(2026, [
    tx({ name: "Overpay", marketValue: 10_000_000, fee: 30_000_000 }),
    tx({ name: "Bargain", marketValue: 40_000_000, fee: 20_000_000, to: club("Thrifty") }),
    tx({
      name: "Freebie",
      marketValue: 45_000_000,
      fee: 0,
      feeText: "free transfer",
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

  it("splits fee-paying signings, frees and loans", () => {
    expect(data.paid.map((t) => t.name)).toEqual(["Overpay", "Bargain"]);
    expect(data.free.map((t) => t.name)).toEqual(["Freebie"]);
    expect(data.loans.map((t) => t.name)).toEqual(["Loanee"]);
  });

  it("prices a free transfer as its whole value saved", () => {
    expect(data.free[0].premium).toBe(-45_000_000);
    expect(data.free[0].ratio).toBe(0);
  });

  it("ranks frees on cash but never on times value", () => {
    const r = rank(data.paid, data.free);
    expect(r.underpaidAbsolute.map((t) => t.name)).toEqual(["Freebie", "Bargain", "Overpay"]);
    expect(r.underpaidRatio.map((t) => t.name)).toEqual(["Bargain", "Overpay"]);
  });

  it("computes premium and ratio per transfer", () => {
    const [overpay, bargain] = data.paid;
    expect(overpay.premium).toBe(20_000_000);
    expect(overpay.ratio).toBe(3);
    expect(bargain.premium).toBe(-20_000_000);
    expect(bargain.ratio).toBe(0.5);
  });

  it("keeps the loan out of every priced pool — a loan is not a signing", () => {
    const priced = [...data.paid, ...data.free].map((t) => t.name);
    expect(priced).not.toContain("Loanee");
    expect(data.loans[0].marketValue).toBe(50_000_000);
  });

  const buying = (name: string, cut = data.clubs.withLoans) =>
    cut.find((c) => c.club.name === name)!;

  it("counts loans and frees towards their club, unlike the player rankings", () => {
    expect(
      data.clubs.withLoans
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
      data.clubs.permanentOnly
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
    const seller = buying("Seller");
    expect(seller.out.players).toBe(4);
    expect(seller.out.marketValue).toBe(145_000_000);
    expect(seller.out.fees).toBe(50_000_000);
    // Negative on the way out means sold below what the players were worth.
    expect(seller.out.premium).toBe(-95_000_000);
    expect(seller.in.players).toBe(0);
  });

  it("nets value and spend across both sides", () => {
    const seller = buying("Seller");
    expect(seller.netValue).toBe(-145_000_000);
    expect(seller.netSpend).toBe(-50_000_000);
    expect(buying("Buyer").netValue).toBe(10_000_000);
    expect(buying("Buyer").netSpend).toBe(30_000_000);
  });

  it("ranks both directions off one sort", () => {
    const r = rank(data.paid);
    expect(r.overpaidAbsolute[0].name).toBe("Overpay");
    expect(r.underpaidAbsolute[0].name).toBe("Bargain");
    expect(r.overpaidRatio[0].name).toBe("Overpay");
    expect(r.underpaidRatio[0].name).toBe("Bargain");
  });
});

describe("market-value guard", () => {
  it("drops a transfer with no market value rather than dividing by zero", () => {
    const data = analyzeTransfers(2026, [
      tx({ name: "Unvalued", marketValue: 0, fee: 5_000_000 }),
      tx({ name: "UnvaluedFree", marketValue: 0, fee: 0, feeText: "free transfer" }),
    ]);
    expect(data.paid).toEqual([]);
    expect(data.free).toEqual([]);
  });
});

describe("ties", () => {
  // Two deals €20m under value: joint biggest bargain, however they happen to sort.
  const tied = analyzeTransfers(2026, [
    tx({ name: "Khannouss", marketValue: 35_000_000, fee: 15_000_000 }),
    tx({ name: "Malen", marketValue: 45_000_000, fee: 25_000_000 }),
    tx({ name: "Solo", marketValue: 30_000_000, fee: 25_000_000 }),
  ]);
  const r = rank(tied.paid);

  it("separates the same pair when the measure does distinguish them", () => {
    expect(
      withRanks(r.underpaidRatio, (t) => t.ratio).map((e) => [e.transfer.name, e.rank]),
    ).toEqual([
      ["Khannouss", 1],
      ["Malen", 2],
      ["Solo", 3],
    ]);
  });

  it("gives tied deals the same rank and skips the next", () => {
    expect(
      withRanks(r.underpaidAbsolute, (t) => t.premium).map((e) => [e.transfer.name, e.rank]),
    ).toEqual([
      ["Khannouss", 1],
      ["Malen", 1],
      ["Solo", 3],
    ]);
  });

  it("survives the float noise of dividing reconstructed euro figures", () => {
    // 0.1 + 0.2 territory: 15/35 and 30/70 are equal, and are not equal in binary.
    const ratios = analyzeTransfers(2026, [
      tx({ name: "A", marketValue: 35_000_000, fee: 15_000_000 }),
      tx({ name: "B", marketValue: 70_000_000, fee: 30_000_000 }),
    ]);
    const ranked = rank(ratios.paid);
    // Both share rank 1: had the raw floats been compared they would differ.
    expect(withRanks(ranked.underpaidRatio, (t) => t.ratio).map((e) => e.rank)).toEqual([1, 1]);
  });
});
