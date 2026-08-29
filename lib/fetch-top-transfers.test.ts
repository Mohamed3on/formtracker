import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTopTransfers } from "./fetch-top-transfers";

// The same real top-transfers page the club-cell tests use. Refresh both when
// Transfermarkt changes its markup.
const html = readFileSync(
  fileURLToPath(new URL("./transfermarkt/__fixtures__/top-transfers.html", import.meta.url)),
  "utf8",
);

const rows = parseTopTransfers(html);

describe("parseTopTransfers — real season top-transfers fixture", () => {
  it("parses a full page of 25 rows, skipping headers and spacers", () => {
    expect(rows).toHaveLength(25);
  });

  it("reads the fee, the market value it is measured against, and both clubs", () => {
    expect(rows[0]).toMatchObject({
      rank: 1,
      playerId: "503743",
      name: "Morgan Rogers",
      position: "Attacking Midfield",
      age: 23,
      nationality: "England",
      marketValue: 90_000_000,
      fee: 138_000_000,
      feeText: "€138.00m",
      isLoan: false,
      from: { name: "Aston Villa", clubId: "405" },
      to: { name: "Chelsea", clubId: "631" },
    });
  });

  it("ships every image at TM's largest size", () => {
    expect(rows[0].imageUrl).toContain("/portrait/header/");
    expect(rows[0].nationalityFlagUrl).toContain("/flagge/head/");
    expect(rows[0].to.logoUrl).toContain("/wappen/head/");
  });

  it("flags loans off the fee cell's wording, not a missing fee", () => {
    // TM prices some loans ("Loan fee:€3.00m") and not others; both are loans.
    for (const r of rows.filter((r) => /loan/i.test(r.feeText))) expect(r.isLoan).toBe(true);
    for (const r of rows.filter((r) => !/loan/i.test(r.feeText))) expect(r.isLoan).toBe(false);
  });

  it("gives every row the identity the page needs to link it up", () => {
    expect(rows.every((r) => r.playerId && r.name && r.marketValue > 0)).toBe(true);
  });
});
