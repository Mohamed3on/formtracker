import type { MetadataRoute } from "next";
import { getMinutesValueData } from "@/lib/fetch-minutes-value";
import { extractClubIdFromLogoUrl } from "@/lib/format";
import { LEAGUES, getLeagueLogoUrl } from "@/lib/leagues";
import { absoluteUrl } from "@/lib/site-config";

const CORE_ROUTES = [
  "/",
  "/discover",
  "/form",
  "/expected-position",
  "/players",
  "/value-analysis",
  "/injured",
  "/biggest-movers",
  "/fee-vs-value",
  "/transfer-balance",
  "/wc-live",
  "/wc",
  "/wc-schedule",
  "/how-it-works",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const players = await getMinutesValueData();
  const latestDataTimestamp = players.reduce(
    (latest, player) => Math.max(latest, player.fetchedAt ?? 0),
    0,
  );
  const dataLastModified = latestDataTimestamp ? new Date(latestDataTimestamp) : now;
  const coreEntries: MetadataRoute.Sitemap = CORE_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : path === "/discover" ? 0.9 : 0.8,
  }));
  const leagueEntries: MetadataRoute.Sitemap = LEAGUES.map((l) => ({
    url: absoluteUrl(`/leagues/${l.slug}`),
    lastModified: dataLastModified,
    changeFrequency: "daily",
    priority: 0.85,
    images: [getLeagueLogoUrl(l.name)].filter((url): url is string => Boolean(url)),
  }));
  const playerEntries: MetadataRoute.Sitemap = players.map((player) => ({
    url: absoluteUrl(`/players/${player.playerId}`),
    lastModified: player.fetchedAt ? new Date(player.fetchedAt) : dataLastModified,
    changeFrequency: "daily",
    priority: 0.7,
    images: player.imageUrl ? [player.imageUrl] : undefined,
  }));
  const teamsById = new Map<
    string,
    {
      logoUrl: string;
      lastModified: Date;
    }
  >();
  for (const player of players) {
    const clubId = extractClubIdFromLogoUrl(player.clubLogoUrl);
    if (!clubId || teamsById.has(clubId)) continue;
    teamsById.set(clubId, {
      logoUrl: player.clubLogoUrl,
      lastModified: player.fetchedAt ? new Date(player.fetchedAt) : dataLastModified,
    });
  }
  const teamEntries: MetadataRoute.Sitemap = Array.from(teamsById, ([clubId, team]) => ({
    url: absoluteUrl(`/teams/${clubId}`),
    lastModified: team.lastModified,
    changeFrequency: "daily",
    priority: 0.75,
    images: team.logoUrl ? [team.logoUrl] : undefined,
  }));

  return [...coreEntries, ...leagueEntries, ...teamEntries, ...playerEntries];
}
