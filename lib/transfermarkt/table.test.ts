import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parsePlayerTable } from "./table";

// A real Premier League injured page, captured 2026-07. Refresh the fixture when
// Transfermarkt changes its markup; the assertions below survive a refresh.
const html = readFileSync(
  fileURLToPath(new URL("./__fixtures__/injured-premier-league.html", import.meta.url)),
  "utf8",
);

// Mirror the injured page's column layout so the fixture exercises the real
// player-listing shape end-to-end (identity + page-specific columns).
const rows = parsePlayerTable(html, (player, row) => ({
  name: player.name,
  playerId: player.playerId,
  profileUrl: player.profileUrl,
  imageUrl: player.imageUrl,
  position: player.position,
  club: row.link(1).title,
  clubLogo: row.image(1),
  marketValue: row.text(7),
}));

describe("parsePlayerTable — real injured (Premier League) fixture", () => {
  it("parses every player row, skipping headers/spacers", () => {
    expect(rows).toHaveLength(32);
  });

  it("parses identity + page-specific columns for a known player", () => {
    const timber = rows.find((r) => r.playerId === "420243");
    expect(timber).toMatchObject({
      name: "Jurriën Timber",
      position: "Right-Back",
      club: "Arsenal FC",
      marketValue: "€70.00m",
      profileUrl: "https://www.transfermarkt.com/jurrien-timber/profil/spieler/420243",
    });
  });

  it("upgrades images to the largest size (tmImage), not the scraped size", () => {
    const timber = rows.find((r) => r.playerId === "420243")!;
    expect(timber.imageUrl).toContain("/portrait/header/"); // scraped as /portrait/medium/
    expect(timber.clubLogo).toContain("/wappen/head/"); // scraped as /wappen/tiny/
  });

  it("matches the parsed snapshot", () => {
    expect(rows).toMatchSnapshot();
  });
});
