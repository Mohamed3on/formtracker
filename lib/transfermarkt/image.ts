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
