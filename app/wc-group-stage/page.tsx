import { createPageMetadata } from "@/lib/metadata";
import { getWcTeams } from "@/lib/wc/teams";
import { getWcFixtures } from "@/lib/wc/fixtures";
import { buildMatchups } from "@/lib/wc/matchups";
import { WcGroupStage } from "./WcGroupStage";

// Re-render at most hourly so live scores stay fresh; the data caches are 1h too.
export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: "World Cup 2026 — Group-Stage Matchups by Value",
  description:
    "All World Cup 2026 group matches ranked by combined squad market value, with live scores and final-matchday dead-rubber flags.",
  path: "/wc-group-stage",
});

export default async function WcGroupStagePage() {
  const [teams, fixtures] = await Promise.all([getWcTeams(), getWcFixtures()]);
  const rows = buildMatchups(teams, fixtures);
  return (
    <div className="py-6 sm:py-10">
      <WcGroupStage rows={rows} />
    </div>
  );
}
