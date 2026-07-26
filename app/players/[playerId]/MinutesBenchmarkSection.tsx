"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { SectionPanel } from "@/components/SectionPanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getPlayerDetailHref } from "@/lib/format";
import type { MinutesValueFilter } from "@/lib/filter-players";
import type { MinutesBenchmark } from "@/lib/player-detail";
import type { MinutesValuePlayer } from "@/app/types";

const VALUE_PHRASE: Record<MinutesValueFilter, string> = {
  pricier: "same-or-higher value",
  cheaper: "same-or-lower value",
  any: "comparable",
};

export function MinutesBenchmarkSection({
  benchmark,
  playerId,
  playerName,
}: {
  benchmark: MinutesBenchmark;
  playerId: string;
  playerName: string;
}) {
  // null = the signal pairing: pricier peers for "playing less", cheaper for "playing more"
  const [valueFilter, setValueFilter] = useState<MinutesValueFilter | null>(null);
  const lessFilter = valueFilter ?? "pricier";
  const moreFilter = valueFilter ?? "cheaper";
  const baseUrl = `/value-analysis?id=${playerId}&name=${encodeURIComponent(playerName)}&mode=mins`;
  const valParam = valueFilter ? `&mVal=${valueFilter}` : "";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Peer value
        </span>
        <ToggleGroup
          type="single"
          size="sm"
          value={valueFilter ?? ""}
          onValueChange={(v) => setValueFilter(v ? (v as MinutesValueFilter) : null)}
        >
          <ToggleGroupItem value="pricier">Same or pricier</ToggleGroupItem>
          <ToggleGroupItem value="cheaper">Same or cheaper</ToggleGroupItem>
          <ToggleGroupItem value="any">Any value</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MinutesBenchmarkPanel
          title="Playing less"
          subtitle={`vs ${VALUE_PHRASE[lessFilter]} peers with equal or more available games`}
          count={benchmark[lessFilter].playingLessCount}
          players={benchmark[lessFilter].playingLess}
          benchmarkUrl={`${baseUrl}&tab=less${valParam}`}
          emptyLabel={`No ${VALUE_PHRASE[lessFilter]} players are playing fewer minutes.`}
          accentClass="text-accent-cold-soft"
        />
        <MinutesBenchmarkPanel
          title="Playing more"
          subtitle={`vs ${VALUE_PHRASE[moreFilter]} peers with equal or fewer available games`}
          count={benchmark[moreFilter].playingMoreCount}
          players={benchmark[moreFilter].playingMore}
          benchmarkUrl={`${baseUrl}&tab=more${valParam}`}
          emptyLabel={`No ${VALUE_PHRASE[moreFilter]} players are playing more minutes.`}
          accentClass="text-accent-hot"
        />
      </div>
    </section>
  );
}

function MinutesBenchmarkPanel({
  title,
  subtitle,
  count,
  players,
  benchmarkUrl,
  emptyLabel,
  accentClass,
}: {
  title: string;
  subtitle: string;
  count: number;
  players: MinutesValuePlayer[];
  benchmarkUrl: string;
  emptyLabel: string;
  accentClass: string;
}) {
  return (
    <SectionPanel
      title={`${title} (${count ?? players.length})`}
      aside={
        <Link
          href={benchmarkUrl}
          className="text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          Full benchmark →
        </Link>
      }
    >
      <p className="mb-3 text-xs text-text-muted">{subtitle}</p>
      <div className="space-y-2">
        {players.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-subtle bg-elevated px-4 py-6 text-sm text-text-secondary">
            {emptyLabel}
          </div>
        ) : (
          players.slice(0, 6).map((p) => (
            <Link
              key={p.playerId}
              href={getPlayerDetailHref(p.playerId)}
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-elevated p-2.5 transition-colors hover:border-border-medium hover:bg-card-hover"
            >
              <PlayerAvatar
                imageUrl={p.imageUrl}
                name={p.name}
                size="sm"
                className="border border-border-subtle"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">{p.name}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {p.club} · {p.marketValueDisplay}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`font-value text-sm ${accentClass}`}>
                  {p.minutes.toLocaleString()}&apos;
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </SectionPanel>
  );
}
