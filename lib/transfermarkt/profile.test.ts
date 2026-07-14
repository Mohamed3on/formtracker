import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseProfileHeader } from "./profile";

// A real player profile (Erling Haaland), captured 2026-07.
const html = readFileSync(
  fileURLToPath(new URL("./__fixtures__/profile-haaland.html", import.meta.url)),
  "utf8",
);
const header = parseProfileHeader(html);

describe("parseProfileHeader — real player profile", () => {
  it("parses club, contract, market value and age", () => {
    expect(header).toMatchObject({
      club: "Man City",
      clubId: "281",
      contractExpiry: "30/06/2034",
      marketValueText: "€200.00m", // the clone-remove trick strips the trailing "as of" <p>
      age: 25,
    });
  });

  it("resolves senior caps and current-international, skipping youth squads", () => {
    expect(header.headerCaps).toBe(55);
    expect(header.headerIsCurrentSenior).toBe(true);
  });

  it("keeps the club crest from srcset but upgrades the flag via tmImage", () => {
    expect(header.clubLogoUrl).toContain("/wappen/"); // srcset first entry, not tmImage'd
    expect(header.nationalityFlagUrl).toContain("/flagge/head/"); // scraped as /flagge/medium/
  });

  it("matches the snapshot", () => {
    expect(header).toMatchSnapshot();
  });
});
