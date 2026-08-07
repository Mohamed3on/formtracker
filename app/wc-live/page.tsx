import { createPageMetadata } from "@/lib/metadata";
import { buildLiveModel } from "@/lib/wc/live";
import { getWcResults } from "@/lib/wc/results";
import { getWcTeams } from "@/lib/wc/teams";
import { getWcManagers } from "@/lib/wc/managers";
import { playerLinks } from "@/lib/wc/linkable-nations";
import { buildWcScorers } from "@/lib/wc/scorers";
import { getMinutesValueData } from "@/lib/fetch-minutes-value";
import { WcLive } from "./WcLive";

// The tournament is over and results are final — daily cache like the rest of
// the site; the header refresh button still busts it on demand.
export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: "World Cup 2026 — Final Results vs Expectations",
  description:
    "World Cup 2026 final results vs the market-value prediction: which teams beat or fell short of the round their squad value seeded them into.",
  path: "/wc-live",
});

export default async function WcLivePage() {
  const [teams, results, players] = await Promise.all([
    getWcTeams(),
    getWcResults(),
    getMinutesValueData(),
  ]);
  const live = buildLiveModel(teams, results);
  const [links, managers] = await Promise.all([playerLinks(teams), getWcManagers()]);
  const scorers = buildWcScorers(players);
  return (
    <div className="py-6 sm:py-10">
      <WcLive live={live} playerLinks={links} managers={managers} scorers={scorers} />
    </div>
  );
}
