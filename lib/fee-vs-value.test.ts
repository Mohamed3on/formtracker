import { describe, expect, it } from "vitest";
import { analyzeTransfers, rank } from "./fee-vs-value";
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
    tx({ name: "Freebie", marketValue: 45_000_000, fee: 0, feeText: "free transfer" }),
    tx({ name: "Loanee", marketValue: 50_000_000, fee: 0, feeText: "loan transfer", isLoan: true }),
  ]);

  it("keeps loans and frees out of the priced pool", () => {
    expect(data.paid.map((t) => t.name)).toEqual(["Overpay", "Bargain"]);
    expect(data.free.map((t) => t.name)).toEqual(["Freebie"]);
    expect(data.loans.map((t) => t.name)).toEqual(["Loanee"]);
  });

  it("computes premium and ratio per transfer", () => {
    const [overpay, bargain] = data.paid;
    expect(overpay.premium).toBe(20_000_000);
    expect(overpay.ratio).toBe(3);
    expect(bargain.premium).toBe(-20_000_000);
    expect(bargain.ratio).toBe(0.5);
  });

  it("totals only the priced pool, so a free transfer can't skew the market ratio", () => {
    expect(data.totals.fees).toBe(50_000_000);
    expect(data.totals.marketValue).toBe(50_000_000);
    expect(data.totals.ratio).toBe(1);
  });

  it("aggregates spend per buying club", () => {
    expect(data.clubs.map((c) => [c.club.name, c.signings, c.premium])).toEqual([
      ["Buyer", 1, 20_000_000],
      ["Thrifty", 1, -20_000_000],
    ]);
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
  it("drops a priced transfer with no market value rather than dividing by zero", () => {
    const data = analyzeTransfers(2026, [tx({ name: "Unvalued", marketValue: 0, fee: 5_000_000 })]);
    expect(data.paid).toEqual([]);
    expect(data.totals.ratio).toBe(0);
  });
});
