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
          <div className="rounded-2xl border border-dashed border-border-subtle bg-elevated px-4 py-6 text-sm text-text-secondary">
            {emptyLabel}
          </div>
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
    sameOrStronger: "&bStronger=1",
    top5: "&bTop5=1",
  }[scope];
  const peerLabel = {
    all: "comparable",
    league: leagueLabel,
    sameOrStronger: "same or stronger league",
    top5: "top 5 league",
  }[scope];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <FilterButton active={scope === "top5"} onClick={() => toggleScope("top5")}>
          Top 5 leagues
        </FilterButton>
        <FilterButton
          active={scope === "sameOrStronger"}
          onClick={() => toggleScope("sameOrStronger")}
        >
          Same or stronger league
        </FilterButton>
        <FilterButton active={scope === "league"} onClick={() => toggleScope("league")}>
          {leagueLabel} only
        </FilterButton>
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Pricier peers he's beating"
          emptyLabel={`No pricier ${peerLabel} peers are behind him on the current value model.`}
          players={underperformers}
          positive
          benchmarkUrl={`${underBenchmarkUrl}${benchmarkSuffix}`}
        />
        <Card
          title="Cheaper peers ahead of him"
          emptyLabel={`No cheaper ${peerLabel} peers are ahead of him on the current value model.`}
          players={outperformers}
          positive={false}
          benchmarkUrl={`${overBenchmarkUrl}${benchmarkSuffix}`}
        />
      </section>
    </div>
  );
}
