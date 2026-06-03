"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/Combobox";
import { buildLeagueGroups } from "@/lib/filter-players";

export function LeagueCombobox<T extends { league: string }>({
  players,
  value,
  onChange,
  getValue,
}: {
  players: T[];
  value: string;
  onChange: (value: string) => void;
  getValue?: (p: T) => number;
}) {
  const groups = useMemo(() => buildLeagueGroups(players, getValue), [players, getValue]);
  return (
    <Combobox
      value={value}
      onChange={onChange}
      groups={groups}
      placeholder="All leagues"
      searchPlaceholder="Search leagues..."
    />
  );
}
