"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { InjuredPlayer } from "@/app/types";
import { InjuredPlayerCard } from "@/components/InjuredPlayerCard";
import { LeagueBadge } from "@/components/LeagueBadge";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RankBadge } from "@/components/RankBadge";
import {
  extractClubIdFromLogoUrl,
  formatReturnInfo,
  formatInjuryDuration,
  formatMarketValue,
  getPlayerDetailHref,
  getPlayerIdFromProfileUrl,
  getTeamDetailHref,
} from "@/lib/format";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { Combobox } from "@/components/Combobox";
import { LeagueCombobox } from "@/components/LeagueCombobox";
import { InfoTip } from "@/app/components/InfoTip";
import { filterPlayersByLeagueAndClub, uniqueFilterOptions } from "@/lib/filter-players";
import { groupPlayersByClub, categorizeInjury, type TeamInjuryGroup } from "@/lib/injury-utils";

interface InjuryTypeGroup {
  injury: string;
  players: InjuredPlayer[];
  totalValue: number;
  count: number;
}

interface InjuryCategoryGroup {
  category: string;
  injuries: InjuryTypeGroup[];
  totalValue: number;
  count: number;
}

export interface InjuredResponse {
  success: boolean;
  players: InjuredPlayer[];
  totalPlayers: number;
  leagues: string[];
}

interface InjuredUIProps {
  initialData: InjuredResponse;
}

function CollapsibleChevron({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={cn(
        className,
        "text-text-muted shrink-0 transition-transform [[data-state=open]>&]:rotate-180",
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function getInjuredPlayerDetailHref(profileUrl: string): string | null {
  const playerId = getPlayerIdFromProfileUrl(profileUrl);
  return playerId ? getPlayerDetailHref(playerId) : null;
}

function TeamInjuryCard({
  team,
  rank,
  index = 0,
}: {
  team: TeamInjuryGroup;
  rank: number;
  index?: number;
}) {
  return (
    <Card
      className="overflow-hidden hover-lift animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <RankBadge rank={rank} />

          {/* Club Logo */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center p-1.5 bg-white shadow-sm">
            {team.clubLogoUrl ? (
              <img
                src={team.clubLogoUrl}
                alt={team.club}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xl text-text-muted">?</div>
            )}
          </div>

          {/* Team Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {(() => {
                  const teamClubId = extractClubIdFromLogoUrl(team.clubLogoUrl);
                  return teamClubId ? (
                    <Link
                      href={getTeamDetailHref(teamClubId)}
                      className="font-bold text-sm sm:text-base text-text-primary hover:underline block"
                    >
                      {team.club}
                    </Link>
                  ) : (
                    <h3 className="font-bold text-sm sm:text-base text-text-primary">
                      {team.club}
                    </h3>
                  );
                })()}
                <LeagueBadge league={team.league} />
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm sm:text-lg font-medium text-accent-hot font-value">
                  {formatMarketValue(team.totalValue)}
                </div>
                <div className="text-[10px] sm:text-xs text-text-muted">
                  {team.count} {team.count === 1 ? "player" : "players"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Player list — mobile */}
        <div className="mt-3 flex flex-col divide-y divide-border-subtle sm:hidden">
          {team.players.map((player) => {
            const ri = formatReturnInfo(player.returnDate);
            const dur = formatInjuryDuration(player.injurySince);
            const detailHref = getInjuredPlayerDetailHref(player.profileUrl);
            return (
              <Link
                key={player.profileUrl || player.name}
                href={detailHref || `https://www.transfermarkt.com${player.profileUrl}`}
                target={detailHref ? undefined : "_blank"}
                rel={detailHref ? undefined : "noopener noreferrer"}
                className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
              >
                <PlayerAvatar
                  imageUrl={player.imageUrl}
                  name="?"
                  className="w-8 h-8 rounded-full shrink-0 text-[10px]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-text-primary truncate">
                      {player.name}
                    </span>
                    <span className="text-xs font-medium text-accent-hot font-value shrink-0">
                      {player.marketValue}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5"
                    suppressHydrationWarning
                  >
                    <span className="text-text-secondary">{player.injury}</span>
                    {dur && (
                      <>
                        <span className="opacity-40">·</span>
                        <span suppressHydrationWarning>out {dur}</span>
                      </>
                    )}
                    {ri && (
                      <>
                        <span className="opacity-40">·</span>
                        <span
                          suppressHydrationWarning
                          className={ri.imminent ? "text-emerald-500 font-medium" : ""}
                        >
                          {ri.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Player rows — desktop */}
        <div className="mt-3 hidden sm:block rounded-lg border border-border-subtle overflow-hidden divide-y divide-border-subtle">
          {team.players.map((player) => {
            const ri = formatReturnInfo(player.returnDate);
            const dur = formatInjuryDuration(player.injurySince);
            const detailHref = getInjuredPlayerDetailHref(player.profileUrl);
            return (
              <Link
                key={player.profileUrl || player.name}
                href={detailHref || `https://www.transfermarkt.com${player.profileUrl}`}
                target={detailHref ? undefined : "_blank"}
                rel={detailHref ? undefined : "noopener noreferrer"}
                className="flex items-center gap-3 px-3 py-2 hover:bg-card-hover transition-colors duration-150 odd:bg-elevated/40"
              >
                <PlayerAvatar
                  imageUrl={player.imageUrl}
                  name="?"
                  className="w-7 h-7 rounded-full shrink-0 text-[10px]"
                />
                <span className="text-sm font-medium text-text-primary w-36 lg:w-44 truncate shrink-0">
                  {player.name}
                </span>
                <span
                  className="text-xs text-text-secondary flex-1 truncate"
                  suppressHydrationWarning
                >
                  {player.injury}
                  {dur && <span className="text-text-muted"> · out {dur}</span>}
                </span>
                {ri && (
                  <span
                    suppressHydrationWarning
                    className={cn(
                      "text-xs shrink-0",
                      ri.imminent ? "text-emerald-500 font-medium" : "text-text-muted",
                    )}
                  >
                    {ri.label}
                  </span>
                )}
                <span className="text-sm font-medium text-accent-hot font-value shrink-0 w-16 text-right">
                  {player.marketValue}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function InjuryCategoryCard({
  group,
  rank,
  index = 0,
  totalValue,
}: {
  group: InjuryCategoryGroup;
  rank: number;
  index?: number;
  totalValue: number;
}) {
  const pct = totalValue > 0 ? (group.totalValue / totalValue) * 100 : 0;
  const isSingleType = group.injuries.length === 1;

  return (
    <Collapsible
      className="rounded-xl border border-border-subtle bg-card animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
    >
      <CollapsibleTrigger className="flex items-center gap-2.5 px-3 py-3 sm:px-4 sm:py-3.5 w-full cursor-pointer hover:bg-card-hover transition-colors rounded-xl">
        <RankBadge rank={rank} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-pixel font-bold text-sm sm:text-base text-text-primary">
              {group.category}
            </h3>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] sm:text-xs text-text-muted font-value">
                {group.count} {group.count === 1 ? "player" : "players"}
              </span>
              <span className="text-xs sm:text-sm font-medium text-accent-hot font-value">
                {formatMarketValue(group.totalValue)}
              </span>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-hot/60 animate-bar-fill"
                style={{ "--bar-width": `${Math.max(pct, 1)}%` } as React.CSSProperties}
              />
            </div>
            <span className="text-[10px] text-text-muted font-value shrink-0">
              {pct.toFixed(1)}%
            </span>
          </div>
          {!isSingleType && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {group.injuries.slice(0, 4).map((inj) => (
                <span
                  key={inj.injury}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-elevated text-text-muted"
                >
                  {inj.injury} <span className="font-value">{inj.count}</span>
                </span>
              ))}
              {group.injuries.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 text-text-muted">
                  +{group.injuries.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
        <CollapsibleChevron />
      </CollapsibleTrigger>

      <CollapsibleContent>
        {isSingleType ? (
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-t border-border-subtle flex flex-wrap gap-1.5">
            {group.injuries[0].players.map((player) => (
              <InjuryPlayerChip key={player.profileUrl || player.name} player={player} />
            ))}
          </div>
        ) : (
          <div className="border-t border-border-subtle px-2 py-2 sm:px-3 sm:py-2.5 space-y-1.5">
            {group.injuries.map((inj) => (
              <InjurySubTypeRow
                key={inj.injury}
                group={inj}
                categoryTotalValue={group.totalValue}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InjuryPlayerChip({ player }: { player: InjuredPlayer }) {
  const ri = formatReturnInfo(player.returnDate);
  const dur = formatInjuryDuration(player.injurySince);
  const detailHref = getInjuredPlayerDetailHref(player.profileUrl);
  return (
    <Link
      href={detailHref || `https://www.transfermarkt.com${player.profileUrl}`}
      target={detailHref ? undefined : "_blank"}
      rel={detailHref ? undefined : "noopener noreferrer"}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] sm:text-xs hover:bg-card-hover transition-colors duration-150 bg-card border border-border-subtle"
      suppressHydrationWarning
    >
      {player.imageUrl && !player.imageUrl.includes("data:image") && (
        <PlayerAvatar
          imageUrl={player.imageUrl}
          name={player.name}
          className="w-4 h-4 sm:w-5 sm:h-5 rounded-full"
        />
      )}
      <span className="text-text-primary">{player.name}</span>
      <span className="text-text-secondary">{player.club}</span>
      <span className="text-accent-hot font-medium font-value">{player.marketValue}</span>
      {dur && (
        <span className="text-text-muted" suppressHydrationWarning>
          out {dur}
        </span>
      )}
      {ri && (
        <span
          suppressHydrationWarning
          className={cn("font-medium", ri.imminent ? "text-emerald-500" : "text-text-muted")}
        >
          {ri.label}
        </span>
      )}
    </Link>
  );
}

function InjurySubTypeRow({
  group,
  categoryTotalValue,
}: {
  group: InjuryTypeGroup;
  categoryTotalValue: number;
}) {
  const pct = categoryTotalValue > 0 ? (group.totalValue / categoryTotalValue) * 100 : 0;

  return (
    <Collapsible className="rounded-lg bg-elevated/40">
      <CollapsibleTrigger className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 w-full cursor-pointer hover:bg-card-hover transition-colors rounded-lg">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs sm:text-sm text-text-secondary">{group.injury}</span>
          <div className="hidden sm:block flex-1 max-w-24 h-1 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-hot/30 animate-bar-fill"
              style={{ "--bar-width": `${Math.max(pct, 3)}%` } as React.CSSProperties}
            />
          </div>
        </div>
        <span className="text-[10px] sm:text-xs text-text-muted font-value">{group.count}</span>
        <span className="text-xs font-medium text-accent-hot font-value">
          {formatMarketValue(group.totalValue)}
        </span>
        <CollapsibleChevron className="w-3.5 h-3.5" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-wrap gap-1.5">
          {group.players.map((player) => (
            <InjuryPlayerChip key={player.profileUrl || player.name} player={player} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StatCell({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </div>
      <div
        className={cn(
          "text-sm sm:text-base font-medium",
          accent ? "text-accent-hot font-value" : "text-text-primary",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] sm:text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}

function StatsHighlights({
  teamGroups,
  injuryTypeGroups,
}: {
  players: InjuredPlayer[];
  teamGroups: TeamInjuryGroup[];
  injuryTypeGroups: InjuryTypeGroup[];
}) {
  const mostPlayersClub = teamGroups.length
    ? teamGroups.reduce((a, b) =>
        b.count > a.count || (b.count === a.count && b.totalValue > a.totalValue) ? b : a,
      )
    : null;
  const mostValueClub = teamGroups.length
    ? teamGroups.reduce((a, b) =>
        b.totalValue > a.totalValue || (b.totalValue === a.totalValue && b.count > a.count) ? b : a,
      )
    : null;
  const topInjury = injuryTypeGroups.length
    ? injuryTypeGroups.reduce((a, b) =>
        b.count > a.count || (b.count === a.count && b.totalValue > a.totalValue) ? b : a,
      )
    : null;
  return (
    <div className="mb-6 sm:mb-8 animate-scale-in rounded-xl border border-border-subtle bg-elevated overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle">
        {mostPlayersClub &&
          (() => {
            const cid = extractClubIdFromLogoUrl(mostPlayersClub.clubLogoUrl);
            const inner = (
              <>
                {mostPlayersClub.clubLogoUrl && (
                  <img
                    src={mostPlayersClub.clubLogoUrl}
                    alt=""
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain rounded-sm bg-white p-px shrink-0 mt-3"
                  />
                )}
                <StatCell
                  label="Most Players Injured"
                  value={mostPlayersClub.club}
                  sub={`${mostPlayersClub.count} players · ${formatMarketValue(mostPlayersClub.totalValue)}`}
                />
              </>
            );
            const cls = "p-3 sm:p-4 flex items-start gap-2 border-l-2 border-l-red-500/50";
            return cid ? (
              <Link
                href={getTeamDetailHref(cid)}
                className={`${cls} hover:bg-card-hover transition-colors`}
              >
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            );
          })()}

        {mostValueClub &&
          (() => {
            const cid = extractClubIdFromLogoUrl(mostValueClub.clubLogoUrl);
            const inner = (
              <>
                {mostValueClub.clubLogoUrl && (
                  <img
                    src={mostValueClub.clubLogoUrl}
                    alt=""
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain rounded-sm bg-white p-px shrink-0 mt-3"
                  />
                )}
                <StatCell
                  label="Most Value Sidelined"
                  value={mostValueClub.club}
                  sub={`${formatMarketValue(mostValueClub.totalValue)} · ${mostValueClub.count} players`}
                />
              </>
            );
            const cls = "p-3 sm:p-4 flex items-start gap-2 border-l-2 border-l-amber-500/50";
            return cid ? (
              <Link
                href={getTeamDetailHref(cid)}
                className={`${cls} hover:bg-card-hover transition-colors`}
              >
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            );
          })()}

        {topInjury && (
          <div className="p-3 sm:p-4 border-l-2 border-l-blue-500/50">
            <StatCell
              label="Most Common Injury"
              value={topInjury.injury}
              sub={`${topInjury.count} players · ${formatMarketValue(topInjury.totalValue)}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

type GroupSort = "value" | "count";

export function InjuredUI({ initialData }: InjuredUIProps) {
  const { params, update } = useQueryParams("/injured");

  const tab = params.get("tab") || "players";
  const leagueFilter = params.get("league") || "all";
  const clubFilter = params.get("club") || "all";
  const teamSort: GroupSort = params.get("tSort") === "count" ? "count" : "value";
  const injurySort: GroupSort = params.get("iSort") === "count" ? "count" : "value";

  const allPlayers = initialData.players;

  const clubOptions = useMemo(
    () => uniqueFilterOptions(allPlayers, (p) => p.club, "All clubs"),
    [allPlayers],
  );

  const players = useMemo(
    () => filterPlayersByLeagueAndClub(allPlayers, leagueFilter, clubFilter),
    [allPlayers, leagueFilter, clubFilter],
  );

  const teamGroups = useMemo(() => {
    const groups = groupPlayersByClub(players);
    return teamSort === "count"
      ? groups.sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
      : groups.sort((a, b) => b.totalValue - a.totalValue);
  }, [players, teamSort]);

  const injuryTypeGroups = useMemo(() => {
    const groupMap = new Map<string, InjuryTypeGroup>();

    players.forEach((player) => {
      const key = player.injury || "Unknown";
      const existing = groupMap.get(key);
      if (existing) {
        existing.players.push(player);
        existing.totalValue += player.marketValueNum;
        existing.count++;
      } else {
        groupMap.set(key, {
          injury: key,
          players: [player],
          totalValue: player.marketValueNum,
          count: 1,
        });
      }
    });

    const groups = Array.from(groupMap.values());
    return injurySort === "count"
      ? groups.sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
      : groups.sort((a, b) => b.totalValue - a.totalValue);
  }, [players, injurySort]);

  const injuryCategoryGroups = useMemo(() => {
    const catMap = new Map<string, InjuryCategoryGroup>();
    for (const group of injuryTypeGroups) {
      const category = categorizeInjury(group.injury);
      const existing = catMap.get(category);
      if (existing) {
        existing.injuries.push(group);
        existing.totalValue += group.totalValue;
        existing.count += group.count;
      } else {
        catMap.set(category, {
          category,
          injuries: [group],
          totalValue: group.totalValue,
          count: group.count,
        });
      }
    }
    const groups = Array.from(catMap.values());
    return injurySort === "count"
      ? groups.sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
      : groups.sort((a, b) => b.totalValue - a.totalValue);
  }, [injuryTypeGroups, injurySort]);

  const totalInjuredValue = useMemo(
    () => players.reduce((sum, p) => sum + p.marketValueNum, 0),
    [players],
  );

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
        <LeagueCombobox
          players={allPlayers}
          value={leagueFilter}
          onChange={(v) => update({ league: v === "all" ? null : v || null })}
          getValue={(p) => p.marketValueNum}
        />
        <Combobox
          value={clubFilter}
          onChange={(v) => update({ club: v === "all" ? null : v || null })}
          options={clubOptions}
          placeholder="All clubs"
          searchPlaceholder="Search clubs..."
        />
      </div>

      {/* Stats Highlights */}
      <StatsHighlights
        players={players}
        teamGroups={teamGroups}
        injuryTypeGroups={injuryTypeGroups}
      />

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => update({ tab: v === "players" ? null : v })}
        className="w-full"
      >
        <TabsList className="mb-4 sm:mb-6">
          <TabsTrigger value="players">All Players</TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            By Team
            <InfoTip>
              Total market value of all injured players at each club — shows which teams are
              carrying the heaviest injury burden in financial terms.
            </InfoTip>
          </TabsTrigger>
          <TabsTrigger value="injuries">By Injury</TabsTrigger>
        </TabsList>

        <TabsContent value="players">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {players.map((player, idx) => (
              <InjuredPlayerCard
                key={`${player.name}-${player.club}`}
                player={player}
                rank={idx + 1}
                index={idx}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <SortToggle
            value={teamSort}
            onChange={(v) => update({ tSort: v === "value" ? null : v })}
          />
          <div className="grid grid-cols-1 gap-3">
            {teamGroups.map((team, idx) => (
              <TeamInjuryCard key={team.club} team={team} rank={idx + 1} index={idx} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="injuries">
          <SortToggle
            value={injurySort}
            onChange={(v) => update({ iSort: v === "value" ? null : v })}
          />
          <div className="grid grid-cols-1 gap-3">
            {injuryCategoryGroups.map((group, idx) => (
              <InjuryCategoryCard
                key={group.category}
                group={group}
                rank={idx + 1}
                index={idx}
                totalValue={totalInjuredValue}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function SortToggle({ value, onChange }: { value: GroupSort; onChange: (v: GroupSort) => void }) {
  return (
    <div className="flex gap-1 mb-3 text-xs">
      <button
        type="button"
        onClick={() => onChange("value")}
        className={cn(
          "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
          value === "value"
            ? "bg-accent-hot/15 text-accent-hot"
            : "text-text-muted hover:text-text-secondary",
        )}
      >
        Total value
      </button>
      <button
        type="button"
        onClick={() => onChange("count")}
        className={cn(
          "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
          value === "count"
            ? "bg-accent-hot/15 text-accent-hot"
            : "text-text-muted hover:text-text-secondary",
        )}
      >
        Most players
      </button>
    </div>
  );
}
