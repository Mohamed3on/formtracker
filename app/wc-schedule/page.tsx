import { createPageMetadata } from "@/lib/metadata";
import { getWcTeams } from "@/lib/wc/teams";
import { getWcFixtures, getWcKnockoutSchedule } from "@/lib/wc/fixtures";
import { getWcResults } from "@/lib/wc/results";
import { buildLiveModel } from "@/lib/wc/live";
import { buildMatchups } from "@/lib/wc/matchups";
import { WcSchedule } from "./WcSchedule";

// The tournament is over and results are final — daily cache like the rest of the site.
export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: "World Cup 2026 — Full Schedule by Squad Value",
  description:
    "Every World Cup 2026 match — group fixtures and projected knockout games — ranked by combined squad market value, with live scores, kickoff dates and times.",
  path: "/wc-schedule",
});

export default async function WcSchedulePage() {
  const [teams, fixtures, results, koDates] = await Promise.all([
    getWcTeams(),
    getWcFixtures(),
    getWcResults(),
    getWcKnockoutSchedule(),
  ]);
  const live = buildLiveModel(teams, results);
  const rows = buildMatchups(teams, fixtures, live, koDates);
  return (
    <div className="py-6 sm:py-10">
      <WcSchedule rows={rows} />
    </div>
  );
}
