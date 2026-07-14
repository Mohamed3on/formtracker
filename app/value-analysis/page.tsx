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
  const defaultPlayers = applyStatsToggles(rawPlayerStats, { includePen: false });

  const MIN_DISCOVERY_MINUTES = 260;
  const defaultUnderperformers = findValueCandidates(defaultPlayers, {
    candidateOutperforms: false,
    minMinutes: MIN_DISCOVERY_MINUTES,
    sortAsc: false,
  }).map(({ count, ...p }) => ({ ...p, outperformedByCount: count }));
  const defaultOverperformers = findValueCandidates(defaultPlayers, {
    candidateOutperforms: true,
    sortAsc: true,
  }).map(({ count, ...p }) => ({ ...p, outperformsCount: count }));

  return (
    <>
      <Suspense>
        <ValueAnalysisUI
          initialAllPlayers={defaultPlayers}
          initialData={slimForClient(foldedPlayers)}
          injuryMap={injuryMap}
          initialUnderperformers={defaultUnderperformers}
          initialOverperformers={defaultOverperformers}
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
