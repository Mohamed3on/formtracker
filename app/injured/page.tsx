import { Suspense } from "react";
import { getInjuredPlayers } from "@/lib/injured";
import { InjuredUI } from "./InjuredUI";
import { createPageMetadata } from "@/lib/metadata";
import { DiscoveryLinkGrid } from "@/app/components/DiscoveryLinkGrid";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Injury Impact Tracker",
  description:
    "Track the costliest injury absences by player, club, and injury type across the Premier League, La Liga, Bundesliga, Serie A, and Ligue 1.",
  path: "/injured",
  keywords: [
    "football injury tracker",
    "soccer injuries today",
    "highest value injured players",
    "injury cost by club",
    "premier league injuries",
  ],
});

export default async function InjuredPage() {
  const data = await getInjuredPlayers();
  return (
    <>
      <Suspense>
        <InjuredUI initialData={data} />
      </Suspense>
      <DiscoveryLinkGrid
        section="injured"
        title="More on injuries"
        description="Track injury cost by player, team, and injury type from dedicated pages."
        currentPath="/injured"
        currentAliases={["/injured?tab=players"]}
      />
    </>
  );
}
