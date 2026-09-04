"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlayerStats } from "@/app/types";
import type { ScopedComparison } from "@/lib/player-detail";
import { type ComparisonScope, scopeToParams } from "@/lib/comparison-scope";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { ComparisonItem } from "@/components/ComparisonItem";
import { FilterButton } from "@/components/FilterButton";
import { SectionPanel } from "@/components/SectionPanel";
import { EmptyNote } from "@/components/EmptyNote";
import { InfoTip } from "@/app/components/InfoTip";

type CardProps = {
  title: string;
  emptyLabel: string;
  players: PlayerStats[];
  positive: boolean;
  benchmarkUrl: string;
};

function Card({ title, emptyLabel, players, positive, benchmarkUrl }: CardProps) {
  return (
    <SectionPanel
      title={title}
      aside={
        <Link
          href={benchmarkUrl}
          className="text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          See full benchmark →
        </Link>
      }
    >
      <div className="space-y-3">
        {players.length === 0 ? (
          <EmptyNote>{emptyLabel}</EmptyNote>
        ) : (
          players.map((player) => (
            <ComparisonItem key={player.playerId} player={player} positive={positive} />
          ))
        )}
      </div>
    </SectionPanel>
  );
}

export function ComparisonPanels({
  comparisons,
  initialScope,
  leagueLabel,
  underBenchmarkUrl,
  overBenchmarkUrl,
}: {
  comparisons: Record<ComparisonScope, ScopedComparison>;
  initialScope: ComparisonScope;
  leagueLabel: string;
  underBenchmarkUrl: string;
  overBenchmarkUrl: string;
}) {
  const pathname = usePathname();
  const { replace } = useQueryParams(pathname);
  const [scope, setScope] = useState<ComparisonScope>(initialScope);

  const toggleScope = (target: Exclude<ComparisonScope, "all">) => {
    const next = scope === target ? "all" : target;
    setScope(next);
    replace(scopeToParams(next));
  };

  const { underperformers, outperformers } = comparisons[scope];
  const benchmarkSuffix = {
    all: "",
    league: "&bLeague=1",
    noLeagueEdge: "&bStronger=1",
    top5: "&bTop5=1",
  }[scope];
  // The no-league-edge scope keeps opposite halves of the league table per side, so the copy names
  // whichever half the list in front of you is drawn from.
  const scopeClause = (peer: "pricier" | "cheaper") =>
    ({
      all: "",
      noLeagueEdge: ` in ${leagueLabel} or a ${peer === "pricier" ? "weaker" : "stronger"} league`,
      league: ` in ${leagueLabel}`,
      top5: " in the top 5 leagues",
    })[scope];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <InfoTip>
          <p>
            Output is compared raw, and a tougher league suppresses it — so each list drops the
            peers whose league alone could explain the gap.
          </p>
          <p className="mt-1.5">
            Pricier peers he&apos;s beating: only those in {leagueLabel} or a weaker league. Cheaper
            peers ahead of him: only those in {leagueLabel} or a stronger league. League strength is
            the total market value of the players in it.
          </p>
        </InfoTip>
        <FilterButton active={scope === "top5"} onClick={() => toggleScope("top5")}>
          Top 5 leagues
        </FilterButton>
        <FilterButton active={scope === "noLeagueEdge"} onClick={() => toggleScope("noLeagueEdge")}>
          No league edge
        </FilterButton>
        <FilterButton active={scope === "league"} onClick={() => toggleScope("league")}>
          {leagueLabel} only
        </FilterButton>
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Pricier peers he's beating"
          emptyLabel={`No pricier peers${scopeClause("pricier")} are behind him on the current value model.`}
          players={underperformers}
          positive
          benchmarkUrl={`${underBenchmarkUrl}${benchmarkSuffix}`}
        />
        <Card
          title="Cheaper peers ahead of him"
          emptyLabel={`No cheaper peers${scopeClause("cheaper")} are ahead of him on the current value model.`}
          players={outperformers}
          positive={false}
          benchmarkUrl={`${overBenchmarkUrl}${benchmarkSuffix}`}
        />
      </section>
    </div>
  );
}
