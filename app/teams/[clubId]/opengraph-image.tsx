import { formatMarketValue, ordinal } from "@/lib/format";
import { getLeagueShareColor } from "@/lib/leagues";
import { createEntityOgImage, OG_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/og-image";
import { getTeamDetailData } from "@/lib/team-detail";

export const alt = "SquadStat team performance report";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const data = await getTeamDetailData(clubId);

  if (!data) {
    return createEntityOgImage({
      badge: "Team report",
      title: "Team performance report",
      subtitle: "Squad value, recent form, player output and injury impact.",
      accent: "#f59e0b",
      metrics: [],
      imageAlt: "Team report",
    });
  }

  const currentStandings = data.teamForm && data.teamForm.points > 0 ? data.teamForm : null;

  return createEntityOgImage({
    badge: "Team report",
    title: data.name,
    subtitle: `${data.league} · Squad, form, value and player performance`,
    accent: getLeagueShareColor(data.league),
    primaryImage: data.logoUrl,
    imageAlt: data.name,
    metrics: [
      {
        label: currentStandings ? "League position" : "Season status",
        value: currentStandings ? ordinal(currentStandings.leaguePosition) : "Pre-season",
        detail: currentStandings ? `${currentStandings.points} points` : data.league,
      },
      {
        label: "Squad value",
        value: formatMarketValue(data.squadValue),
        detail: `${data.squad.length} tracked players`,
      },
      {
        label: "Vs expectation",
        value: currentStandings
          ? `${currentStandings.deltaPts > 0 ? "+" : ""}${currentStandings.deltaPts}`
          : "—",
        detail: currentStandings ? "points gap" : "Season not started",
      },
    ],
  });
}
