import { leagueLogoUrl } from "@/lib/transfermarkt/image";

export const LEAGUES = [
  {
    code: "GB1",
    name: "Premier League",
    slug: "premier-league",
    hex: "#38003c",
    tailwindBg: "bg-purple-900",
    textOnBg: "text-white",
  },
  {
    code: "ES1",
    name: "La Liga",
    slug: "laliga",
    hex: "#ff4b44",
    tailwindBg: "bg-orange-500",
    textOnBg: "text-white",
  },
  {
    code: "L1",
    name: "Bundesliga",
    slug: "bundesliga",
    hex: "#d20515",
    tailwindBg: "bg-red-600",
    textOnBg: "text-white",
  },
  {
    code: "IT1",
    name: "Serie A",
    slug: "serie-a",
    hex: "#024494",
    tailwindBg: "bg-blue-700",
    textOnBg: "text-white",
  },
  {
    code: "FR1",
    name: "Ligue 1",
    slug: "ligue-1",
    hex: "#dae025",
    tailwindBg: "bg-yellow-400",
    textOnBg: "text-black",
  },
] as const;

export type League = (typeof LEAGUES)[number];

const leagueLogoMap: Record<string, string> = {};
for (const l of LEAGUES) {
  const url = leagueLogoUrl(l.code);
  leagueLogoMap[l.name] = url;
  // Also map normalized key (lowercase, no spaces) for scraped names like "LaLiga"
  leagueLogoMap[l.name.toLowerCase().replace(/\s/g, "")] = url;
}

export function getLeagueLogoUrl(leagueName: string): string | undefined {
  return leagueLogoMap[leagueName] || leagueLogoMap[leagueName.toLowerCase().replace(/\s/g, "")];
}

const leagueSlugMap: Record<string, string> = {};
const transfermarktLeagueUrlMap: Record<string, string> = {};
for (const l of LEAGUES) {
  const tmUrl = `https://www.transfermarkt.com/${l.slug}/startseite/wettbewerb/${l.code}`;
  const normalizedKey = l.name.toLowerCase().replace(/\s/g, "");
  leagueSlugMap[l.name] = l.slug;
  leagueSlugMap[normalizedKey] = l.slug;
  transfermarktLeagueUrlMap[l.name] = tmUrl;
  transfermarktLeagueUrlMap[normalizedKey] = tmUrl;
}

export function getLeagueSlug(leagueName: string): string | undefined {
  return leagueSlugMap[leagueName] || leagueSlugMap[leagueName.toLowerCase().replace(/\s/g, "")];
}

export function getLeagueUrl(leagueName: string): string | undefined {
  const slug = getLeagueSlug(leagueName);
  return slug ? `/leagues/${slug}` : undefined;
}

export function getTransfermarktLeagueUrl(leagueName: string): string | undefined {
  return (
    transfermarktLeagueUrlMap[leagueName] ||
    transfermarktLeagueUrlMap[leagueName.toLowerCase().replace(/\s/g, "")]
  );
}

export function getLeagueBySlug(slug: string): League | undefined {
  return LEAGUES.find((l) => l.slug === slug);
}

/** True when two league names refer to the same league, despite scrape variants like "La Liga" vs "LaLiga". */
export function isSameLeague(a: string, b: string): boolean {
  const slugA = getLeagueSlug(a);
  return slugA !== undefined && slugA === getLeagueSlug(b);
}

const leagueColorMap: Record<string, string> = {};
const leagueStyleMap: Record<string, { bg: string; text: string; hex: string }> = {};
for (const l of LEAGUES) {
  const key = l.name;
  const normalizedKey = l.name.toLowerCase().replace(/\s/g, "");
  leagueColorMap[key] = l.hex;
  leagueColorMap[normalizedKey] = l.hex;
  const style = { bg: l.tailwindBg, text: l.textOnBg, hex: l.hex };
  leagueStyleMap[key] = style;
  leagueStyleMap[normalizedKey] = style;
}

export function getLeagueColor(leagueName: string): string {
  return (
    leagueColorMap[leagueName] ||
    leagueColorMap[leagueName.toLowerCase().replace(/\s/g, "")] ||
    "#666"
  );
}

export function getLeagueStyle(leagueName: string): { bg: string; text: string; hex: string } {
  return (
    leagueStyleMap[leagueName] ||
    leagueStyleMap[leagueName.toLowerCase().replace(/\s/g, "")] || {
      bg: "bg-gray-600",
      text: "text-white",
      hex: "#666",
    }
  );
}
