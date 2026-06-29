import { createPageMetadata } from "@/lib/metadata";
import { buildLiveModel } from "@/lib/wc/live";
import { getWcResults } from "@/lib/wc/results";
import { getWcTeams } from "@/lib/wc/teams";
import { playerLinks } from "@/lib/wc/linkable-nations";
import { WcLive } from "./WcLive";

// Re-render at most hourly so live results/standings stay fresh (the underlying
// data caches are 1h too); the header refresh button still busts it on demand.
export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: "World Cup 2026 — Live vs Expectations",
  description:
    "Live World Cup 2026 tracker: real results overwriting the market-value prediction, showing which teams beat or fall short of the round their squad value seeds them into.",
  path: "/wc-live",
});

export default async function WcLivePage() {
  const [teams, results] = await Promise.all([getWcTeams(), getWcResults()]);
  const live = buildLiveModel(teams, results);
  const links = await playerLinks(teams);
  return (
    <div className="py-6 sm:py-10">
      <WcLive live={live} playerLinks={links} />
    </div>
  );
}
