"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NationalityFlag } from "@/components/NationalityFlag";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getPlayerDetailHref } from "@/lib/format";
import type { MinutesValuePlayer } from "@/app/types";
import { npga } from "@/lib/stats-toggles";
import { getShortPosition } from "@/lib/positions";
import { EmptyNote } from "@/components/EmptyNote";

type SortKey = "value" | "mins" | "games" | "ga" | "pen";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "value", label: "Value" },
  { key: "ga", label: "npG+A" },
  { key: "mins", label: "Mins" },
  { key: "games", label: "Games" },
  { key: "pen", label: "Pen" },
];

function SquadPlayerRow({
  player,
  rank,
  sortBy,
  showClub,
}: {
  player: MinutesValuePlayer;
  rank: number;
  sortBy: SortKey;
  showClub: boolean;
}) {
  const playerNpga = npga(player);
  const penGoals = player.penaltyGoals ?? 0;
  const penMisses = player.penaltyMisses ?? 0;
  const penAttempts = penGoals + penMisses;

  return (
    <Link
      href={getPlayerDetailHref(player.playerId)}
      className="flex items-center gap-2 rounded-xl border border-border-subtle bg-elevated p-2.5 transition-colors hover:border-border-medium hover:bg-card-hover sm:gap-3"
    >
      {/* At 320px the fixed furniture left the name and market value only 66px of the
          254px row. The rank chip is the one piece the list's own order already tells
          you, so it goes first on the narrowest screens. */}
      <div className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/20 text-xs font-value text-text-muted sm:flex">
        {rank}
      </div>
      <PlayerAvatar
        imageUrl={player.imageUrl}
        name={player.name}
        size="sm"
        className="border border-border-subtle"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{player.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-secondary">
          {showClub && player.clubLogoUrl && (
            <img
              src={player.clubLogoUrl}
              alt={player.club}
              title={player.club}
              className="h-3.5 w-3.5 shrink-0 object-contain"
            />
          )}
          <NationalityFlag url={player.nationalityFlagUrl} name={player.nationality} />
          <span className="truncate">
            <span title={player.position}>{getShortPosition(player.position)}</span> · {player.age}y
            · {player.marketValueDisplay}
          </span>
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-4 text-right sm:flex">
        <div>
          <p className="text-sm font-value text-accent-hot">{playerNpga}</p>
          <p className="text-[10px] text-text-muted">npG+A</p>
        </div>
        <div>
          <p className="text-sm font-value text-text-primary">{player.goals}</p>
          <p className="text-[10px] text-text-muted">goals</p>
        </div>
        <div>
          <p className="text-sm font-value text-text-primary">{player.assists}</p>
          <p className="text-[10px] text-text-muted">assists</p>
        </div>
        {sortBy === "pen" && penAttempts > 0 && (
          <div>
            <p className="text-sm font-value text-text-primary">
              {penGoals}/{penAttempts}
            </p>
            <p className="text-[10px] text-text-muted">pen</p>
          </div>
        )}
        <div>
          <p className="text-sm font-value text-accent-blue">
            {player.minutes.toLocaleString()}&apos;
          </p>
          <p className="text-[10px] text-text-muted">mins</p>
        </div>
      </div>
      {/* Mobile stats */}
      <div className="flex shrink-0 items-center gap-2 text-right sm:hidden">
        <span className="text-sm font-value text-accent-hot">{playerNpga}</span>
        <span className="text-xs font-value text-text-muted">
          {player.minutes.toLocaleString()}&apos;
        </span>
      </div>
    </Link>
  );
}

export function SquadTab({
  squad,
  defaultSort = "value",
  emptyLabel = "No tracked players found for this club.",
  limit,
  showClub = false,
}: {
  squad: MinutesValuePlayer[];
  defaultSort?: SortKey;
  emptyLabel?: string;
  limit?: number;
  showClub?: boolean;
}) {
  const [sortBy, setSortBy] = useState<SortKey>(defaultSort);
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const list = [...squad];
    list.sort((a, b) => {
      let diff: number;
      switch (sortBy) {
        case "mins":
          diff = b.minutes - a.minutes;
          break;
        case "games":
          diff = b.totalMatches - a.totalMatches;
          break;
        case "ga":
          diff = npga(b) - npga(a) || a.minutes - b.minutes;
          break;
        case "pen":
          diff = (b.penaltyGoals ?? 0) - (a.penaltyGoals ?? 0);
          break;
        default:
          diff = b.marketValue - a.marketValue;
      }
      return sortAsc ? -diff : diff;
    });
    return limit ? list.slice(0, limit) : list;
  }, [squad, sortBy, sortAsc, limit]);

  if (squad.length === 0) {
    return <EmptyNote>{emptyLabel}</EmptyNote>;
  }

  return (
    <div className="space-y-4">
      {/* Bleed must match .page-container's 12px mobile padding (px-3) — -mx-5 pushed
          this 8px past each viewport edge on every squad and league page. */}
      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <ToggleGroup
          type="single"
          value={sortBy}
          onValueChange={(v) => {
            if (!v) {
              setSortAsc(!sortAsc);
              return;
            }
            setSortBy(v as SortKey);
            setSortAsc(false);
          }}
          className="rounded-lg overflow-hidden border border-border-subtle w-max"
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="px-2.5 py-2 sm:py-1 text-[10px] sm:text-xs font-medium uppercase tracking-wide rounded-none border-0 flex items-center gap-1 text-text-muted data-[state=on]:bg-elevated data-[state=on]:text-text-primary"
            >
              {label}
              {sortBy === key && <span className="text-[10px]">{sortAsc ? "▲" : "▼"}</span>}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="space-y-3">
        {sorted.map((player, i) => (
          <SquadPlayerRow
            key={player.playerId}
            player={player}
            rank={i + 1}
            sortBy={sortBy}
            showClub={showClub}
          />
        ))}
      </div>
    </div>
  );
}
