import { Suspense } from "react";
import { getMinutesValueData, slimForClient } from "@/lib/fetch-minutes-value";
import { getInjuredPlayers } from "@/lib/injured";
import { buildInjuryMap } from "@/lib/injury-utils";
import { DataLastUpdated } from "@/app/components/DataLastUpdated";
import { PlayersUI } from "./PlayersUI";
import { createPageMetadata } from "@/lib/metadata";
import { DiscoveryLinkGrid } from "@/app/components/DiscoveryLinkGrid";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Player Explorer",
  description:
    "Filter and rank 500+ elite players by market value, minutes, goals + assists, loans, and new signings across the Premier League, La Liga, Bundesliga, Serie A, and Ligue 1.",
  path: "/players",
  keywords: [
    "football player stats",
    "soccer player rankings",
    "top loan players europe",
    "highest scoring new signings",
    "player minutes analysis",
  ],
});

export default async function PlayersPage() {
  const [players, injuredData] = await Promise.all([getMinutesValueData(), getInjuredPlayers()]);

  const injuryMap = buildInjuryMap(injuredData.players);

  return (
    <>
      <Suspense>
        <PlayersUI
          initialData={slimForClient(players, { trimRecentForm: true })}
          injuryMap={injuryMap}
        />
      </Suspense>
      <DiscoveryLinkGrid
        section="players"
        title="Player scouting views"
        description="Use purpose-built filters for loans, new signings, and top-5 output leaders."
        currentPath="/players"
      />
      <DataLastUpdated />
    </>
  );
}
