import { describe, it, expect } from "vitest";
import { tmImage, crestUrl, flagUrl, leagueLogoUrl } from "./image";

describe("tmImage — upgrade a scraped URL to its family's largest size", () => {
  it("upgrades each family, preserving the //images quirk and the ?lm query", () => {
    expect(tmImage("https://x//images/portrait/small/1.jpg?lm=1")).toBe(
      "https://x//images/portrait/header/1.jpg?lm=1",
    );
    expect(tmImage("https://x//images/wappen/tiny/1.png")).toBe(
      "https://x//images/wappen/head/1.png",
    );
    expect(tmImage("https://x//images/flagge/verysmall/1.png")).toBe(
      "https://x//images/flagge/head/1.png",
    );
    expect(tmImage("https://x//images/logo/verytiny/gb1.png")).toBe(
      "https://x//images/logo/header/gb1.png",
    );
  });

  it("leaves unknown families and empty input untouched", () => {
    expect(tmImage("")).toBe("");
    expect(tmImage("https://x/other/small/1.png")).toBe("https://x/other/small/1.png");
  });
});

describe("construction helpers — build a URL from an id, at the largest size", () => {
  it("uses the same per-family vocabulary as tmImage", () => {
    expect(crestUrl("281")).toBe("https://tmssl.akamaized.net/images/wappen/head/281.png");
    expect(flagUrl("125")).toBe("https://tmssl.akamaized.net/images/flagge/head/125.png");
    expect(leagueLogoUrl("GB1")).toBe("https://tmssl.akamaized.net/images/logo/header/gb1.png");
  });
});
