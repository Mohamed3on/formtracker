import type { InjuredPlayer } from "@/app/types";
import { getMinutesValueData } from "@/lib/fetch-minutes-value";
import { formatMarketValue } from "@/lib/format";
import { getInjuredPlayers } from "@/lib/injured";
import { getLeagueBySlug, getLeagueLogoUrl, isSameLeague } from "@/lib/leagues";
import { createEntityOgImage, OG_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/og-image";
import { getTeamFormData } from "@/lib/team-form";

export const alt = "SquadStat league analytics dashboard";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = getLeagueBySlug(slug);

  if (!league) {
    return createEntityOgImage({
      badge: "League dashboard",
      title: "League analytics",
      subtitle: "Standings, form, player output, market value and injury impact.",
      accent: "#58a6ff",
      metrics: [],
      imageAlt: "League analytics",
    });
  }

  const [teamFormData, allPlayers, injuredData] = await Promise.all([
    getTeamFormData().catch(() => null),
    getMinutesValueData(),
    getInjuredPlayers().catch(() => ({ players: [] as InjuredPlayer[] })),
  ]);
  const inLeague = (name: string) => isSameLeague(name, league.name);
  const teams = teamFormData?.allTeams.filter((team) => inLeague(team.league)) ?? [];
  const players = allPlayers.filter((player) => inLeague(player.league));
  const injured = (injuredData.players ?? []).filter((player) => inLeague(player.league));
  const injuredValue = injured.reduce((sum, player) => sum + player.marketValueNum, 0);

  return createEntityOgImage({
    badge: "League dashboard",
    title: league.name,
    subtitle: "Standings, form leaders, player output and injury impact",
    accent: league.shareHex,
    primaryImage: getLeagueLogoUrl(league.name),
    imageAlt: league.name,
    metrics: [
      {
        label: "Teams",
        value: String(teams.length),
        detail: "in standings",
      },
      {
        label: "Tracked players",
        value: String(players.length),
        detail: "active dataset",
      },
      {
        label: "Injured value",
        value: injured.length > 0 ? formatMarketValue(injuredValue) : "—",
        detail: `${injured.length} players sidelined`,
      },
    ],
  });
}
