import { Suspense } from "react";
import {
  getMinutesValueData,
  includeTournamentStats,
  toPlayerStats,
  applyStatsToggles,
  slimForClient,
} from "@/lib/fetch-minutes-value";
import { getInjuredPlayers } from "@/lib/injured";
import { buildInjuryMap } from "@/lib/injury-utils";
import { findValueCandidates } from "@/lib/value-analysis";
import type { PlayerStats } from "@/app/types";
import { DataLastUpdated } from "@/app/components/DataLastUpdated";
import { ValueAnalysisUI } from "./ValueAnalysisUI";
import { createPageMetadata } from "@/lib/metadata";
import { DiscoveryLinkGrid } from "@/app/components/DiscoveryLinkGrid";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Over/Under",
  description:
    "Find overpriced players who underdeliver and bargain players outperforming their price tag across Europe's top 5 leagues. Analyze by G+A output and minutes played.",
  path: "/value-analysis",
  keywords: [
    "overpriced football players",
    "bargain soccer players",
    "player value efficiency",
    "underperforming expensive players",
    "minutes per goal analysis",
  ],
});

export default async function ValueAnalysisPage() {
  const [mvPlayers, injuredData] = await Promise.all([getMinutesValueData(), getInjuredPlayers()]);

  const injuryMap = buildInjuryMap(injuredData.players);

  // Fold major-tournament national-team stats once; flows to the client via
  // initialData and into the precomputed candidate lists below.
  const foldedPlayers = mvPlayers.map(includeTournamentStats);
  const rawPlayerStats = foldedPlayers.map(toPlayerStats);

  // Precompute discovery candidates for both penalty-toggle states so the client
  // never runs the findValueCandidates domination pass. (Comparison counts still
  // recompute client-side when the league scope narrows.)
  const MIN_DISCOVERY_MINUTES = 260;
  const candidatesFor = (players: PlayerStats[]) => ({
    under: findValueCandidates(players, {
      candidateOutperforms: false,
      minMinutes: MIN_DISCOVERY_MINUTES,
      sortAsc: false,
    }).map(({ count, ...p }) => ({ ...p, comparisonCount: count })),
    over: findValueCandidates(players, {
      candidateOutperforms: true,
      sortAsc: true,
    }).map(({ count, ...p }) => ({ ...p, comparisonCount: count })),
  });
  const discovery = {
    off: candidatesFor(applyStatsToggles(rawPlayerStats, { includePen: false })),
    on: candidatesFor(applyStatsToggles(rawPlayerStats, { includePen: true })),
  };

  return (
    <>
      <Suspense>
        <ValueAnalysisUI
          initialData={slimForClient(foldedPlayers)}
          injuryMap={injuryMap}
          discovery={discovery}
        />
      </Suspense>
      <DiscoveryLinkGrid
        section="value-analysis"
        title="Over/Under views"
        description="Jump straight into overpriced, bargain, and low-minutes views."
        currentPath="/value-analysis"
        currentAliases={["/value-analysis?mode=ga"]}
      />
      <DataLastUpdated />
    </>
  );
}
