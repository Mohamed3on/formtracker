import { getLeagueShareColor } from "@/lib/leagues";
import { createEntityOgImage, OG_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/og-image";
import { getPlayerDetailData, seasonNpga } from "@/lib/player-detail";

export const alt = "SquadStat player performance report";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const data = await getPlayerDetailData(playerId);

  if (!data) {
    return createEntityOgImage({
      badge: "Player report",
      title: "Player performance report",
      subtitle: "Form, output, value and peer rankings across Europe’s top leagues.",
      accent: "#58a6ff",
      metrics: [],
      imageAlt: "Player report",
    });
  }

  const { player, positionLabel } = data;

  return createEntityOgImage({
    badge: "Player report",
    title: player.name,
    subtitle: `${positionLabel} · ${player.club} · ${player.league}`,
    accent: getLeagueShareColor(player.league),
    primaryImage: player.imageUrl,
    secondaryImage: player.clubLogoUrl,
    imageAlt: player.name,
    metrics: [
      {
        label: "Market value",
        value: player.marketValueDisplay,
        detail: `#${data.rankings.marketValueLeague} in league`,
      },
      {
        label: "Non-pen. G+A",
        value: String(seasonNpga(player)),
        detail: `${player.goals} goals · ${player.assists} assists`,
      },
      {
        label: "Minutes",
        value: player.minutes.toLocaleString("en"),
        detail: `${player.totalMatches} appearances`,
      },
    ],
  });
}
