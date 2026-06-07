import { createPageMetadata } from "@/lib/metadata";
import { buildLiveModel } from "@/lib/wc/live";
import { getWcResults } from "@/lib/wc/results";
import { getWcTeams } from "@/lib/wc/teams";
import { WcLive } from "./WcLive";

export const metadata = {
  ...createPageMetadata({
    title: "World Cup 2026 — Live vs Expectations",
    description:
      "Live World Cup 2026 tracker: real results overwriting the market-value prediction, showing which teams beat or fall short of the round their squad value seeds them into.",
    path: "/wc-live",
  }),
  robots: { index: false, follow: false },
};

export default async function WcLivePage() {
  const [teams, results] = await Promise.all([getWcTeams(), getWcResults()]);
  const live = buildLiveModel(teams, results);
  return (
    <div className="py-6 sm:py-10">
      <WcLive live={live} />
    </div>
  );
}
