// Transfermarkt serves each image at several sizes, with the size as a path
// segment after the image family: .../<family>/<size>/<id>.<ext>. Families use
// different words for their largest variant (portraits use "header", crests use
// "head"), so "largest" is a small per-family map rather than one fixed segment.
// tmImage collapses the six ad-hoc size-rewrite regexes that were scattered across
// the scrapers into one rule.
const LARGEST_SIZE: Record<string, string> = {
  portrait: "header", // player headshots
  wappen: "head", // club crests
  flagge: "head", // nation flags
  logo: "header", // league / competition logos
};

const SIZE_SEGMENT = /\/(portrait|wappen|flagge|logo)\/[a-z]+\//i;

/**
 * Upgrade a scraped Transfermarkt image URL to the largest size for its family.
 * Unknown families — and URLs already at the largest size — pass through unchanged.
 */
export function tmImage(url: string): string {
  if (!url) return "";
  return url.replace(SIZE_SEGMENT, (segment, family: string) => {
    const largest = LARGEST_SIZE[family.toLowerCase()];
    return largest ? `/${family}/${largest}/` : segment;
  });
}

// The other direction: build an image URL from an id, at each family's largest
// size (the same vocabulary tmImage upgrades to). TM serves the asset at both
// `/images/...` and `//images/...`; we use the single-slash canonical form.
const IMAGE_CDN = "https://tmssl.akamaized.net/images";

/** Club crest URL for a Transfermarkt club id. */
export function crestUrl(clubId: string): string {
  return `${IMAGE_CDN}/wappen/head/${clubId}.png`;
}

/** Nation flag URL for a Transfermarkt land id. */
export function flagUrl(landId: string): string {
  return `${IMAGE_CDN}/flagge/head/${landId}.png`;
}

/** League / competition logo URL for a competition code. */
export function leagueLogoUrl(code: string): string {
  return `${IMAGE_CDN}/logo/header/${code.toLowerCase()}.png`;
}
