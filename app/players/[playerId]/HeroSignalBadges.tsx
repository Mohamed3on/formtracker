"use client";

import { Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { SignalBadge } from "@/components/SignalBadge";
import { paramsToScope, type ComparisonScope } from "@/lib/comparison-scope";
import type { PlayerSignalSummary } from "@/lib/player-detail";

export function HeroSignalBadges({
  signalSummaries,
  leagueLabel,
}: {
  signalSummaries: Record<ComparisonScope, PlayerSignalSummary>;
  leagueLabel: string;
}) {
  const params = useSearchParams();
  const scope = paramsToScope({
    sameLeague: params.get("sameLeague"),
    allLeagues: params.get("allLeagues"),
    top5: params.get("top5"),
  });
  const summary = signalSummaries[scope];
  const scopeSuffix = {
    all: "",
    sameOrStronger: " in same or stronger leagues",
    league: ` in ${leagueLabel}`,
    top5: " in the top 5 leagues",
  }[scope];

  return (
    <>
      {summary.discoveryStatus === "bargain" && summary.cheaperPlayersBeatingTarget === 0 && (
        <SignalBadge className="border-accent-hot-border bg-accent-hot-glow text-accent-hot">
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          Outperforming {summary.pricierPlayersBeatenByTarget} pricier peers{scopeSuffix}
        </SignalBadge>
      )}
      {summary.discoveryStatus === "overpriced" && summary.pricierPlayersBeatenByTarget === 0 && (
        <SignalBadge className="border-accent-cold-border bg-accent-cold-glow text-accent-cold-soft">
          {summary.cheaperPlayersBeatingTarget} cheaper peers{scopeSuffix} with more output
        </SignalBadge>
      )}
    </>
  );
}
