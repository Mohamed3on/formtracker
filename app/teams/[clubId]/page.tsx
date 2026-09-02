import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Crown, Medal, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { Suspense } from "react";
import { DetailHero, DetailPageShell } from "@/components/DetailHero";
import { createPageMetadata } from "@/lib/metadata";
import {
  extractClubIdFromLogoUrl,
  formatInjuryDuration,
  formatMarketValue,
  formatReturnInfo,
  getPlayerDetailHref,
  getPlayerIdFromProfileUrl,
  ordinal,
} from "@/lib/format";
import { getTeamDetailData } from "@/lib/team-detail";
import { slimForClient } from "@/lib/fetch-minutes-value";
import { getInjuredPlayers } from "@/lib/injured";
import { getWorstHitResult } from "@/lib/injury-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeagueBadge } from "@/components/LeagueBadge";
import { ComparisonItem } from "@/components/ComparisonItem";
import { DetailDeck } from "@/components/DetailDeck";
import { HeroMetric } from "@/components/HeroMetric";
import { SectionPanel } from "@/components/SectionPanel";
import { ClubWindowBadges } from "./ClubWindowBadges";
import { SquadTab } from "./SquadTab";
import { TransfersTab } from "./TransfersTab";
import { ManagerClient } from "./TeamDeferredData";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { InjuredPlayer } from "@/app/types";
import { JsonLd } from "@/components/JsonLd";
import { getLeagueUrl } from "@/lib/leagues";
import { absoluteUrl } from "@/lib/site-config";

function InjuredPlayerRow({ player }: { player: InjuredPlayer }) {
  const returnInfo = formatReturnInfo(player.returnDate);
  const duration = formatInjuryDuration(player.injurySince);
  const playerId = getPlayerIdFromProfileUrl(player.profileUrl);
  const href = playerId
    ? getPlayerDetailHref(playerId)
    : `https://www.transfermarkt.com${player.profileUrl}`;
  return (
    <Link
      href={href}
      target={playerId ? undefined : "_blank"}
      rel={playerId ? undefined : "noopener noreferrer"}
      className="flex items-center gap-3 rounded-xl border border-border-subtle bg-elevated p-2.5 transition-colors hover:border-border-medium hover:bg-card-hover"
    >
      <PlayerAvatar
        imageUrl={player.imageUrl}
        name={player.name}
        size="sm"
        className="border border-border-subtle"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{player.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
          <span>{player.position}</span>
          <span className="opacity-40">·</span>
          <span className="text-red-400">{player.injury}</span>
          {duration && (
            <>
              <span className="opacity-40">·</span>
              <span>out {duration}</span>
            </>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-value text-accent-hot">{player.marketValue}</p>
        {returnInfo && (
          <p
            className={`text-[11px] ${returnInfo.imminent ? "text-emerald-400 font-medium" : "text-text-muted"}`}
          >
            {returnInfo.label}
          </p>
        )}
      </div>
    </Link>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubId: string }>;
}): Promise<Metadata> {
  const { clubId } = await params;
  const data = await getTeamDetailData(clubId);

  if (!data) {
    return createPageMetadata({
      title: "Team Report",
      description: "Detailed team report with squad, value analysis, and injuries.",
      path: `/teams/${clubId}`,
      noIndex: true,
    });
  }

  const standingsSummary =
    data.teamForm && data.teamForm.points > 0
      ? `${ordinal(data.teamForm.leaguePosition)} in ${data.league} with ${data.teamForm.points} points`
      : `compete in ${data.league}`;

  return createPageMetadata({
    title: `${data.name} Squad, Form, Injuries & Market Value`,
    description: `${data.name} ${standingsSummary}, with ${data.squad.length} tracked players and a ${formatMarketValue(data.squadValue)} squad value. Explore form, injuries and player analysis.`,
    path: `/teams/${clubId}`,
    keywords: [
      data.name,
      `${data.name} squad`,
      `${data.name} stats`,
      `${data.name} injuries`,
      data.league,
      "team report",
      "squad analysis",
    ],
  });
}

export default async function TeamDetailPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const [data, injuredData] = await Promise.all([
    getTeamDetailData(clubId),
    getInjuredPlayers().catch(() => ({ players: [] as import("@/app/types").InjuredPlayer[] })),
  ]);
  const allInjured = injuredData.players ?? [];
  const clubInjuries = allInjured.filter((p) => extractClubIdFromLogoUrl(p.clubLogoUrl) === clubId);
  const worstHit = getWorstHitResult(clubId, clubInjuries, allInjured);

  if (!data) {
    if (/^\d+$/.test(clubId)) {
      const url = `https://www.transfermarkt.com/x/startseite/verein/${clubId}`;
      return (
        <div className="mx-auto flex min-h-64 max-w-md flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-elevated">
            <ArrowUpRight className="h-5 w-5 text-text-muted" />
          </div>
          <div>
            <p className="text-lg font-pixel text-text-primary">Not in tracked dataset</p>
            <p className="mt-1 text-sm text-text-secondary">Redirecting to Transfermarkt&hellip;</p>
          </div>
          <meta httpEquiv="refresh" content={`1;url=${url}`} />
          <a
            href={url}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-elevated px-4 py-2 text-sm text-text-primary transition-colors hover:bg-card-hover"
          >
            Go now
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <Link
            href="/expected-position"
            className="text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            &larr; Back to team rankings
          </Link>
        </div>
      );
    }
    notFound();
  }

  const {
    name,
    logoUrl,
    league,
    clubUrl,
    teamForm,
    squad,
    formPresence,
    recentForm,
    overperformers,
    underperformers,
    trendPlayers,
  } = data;

  // Compute which form cells to highlight (most extreme rank across all periods)
  const formHighlights = new Set<string>();
  let formExtremeType: "best" | "worst" = "best";
  {
    const statKeys = ["points", "goalsScored", "goalsConceded", "goalDiff"] as const;
    let extremeDist = Infinity;
    for (const { period: p, ranks: r, totalTeams: t } of recentForm) {
      for (const k of statKeys) {
        const fromTop = r[k];
        const fromBottom = t - r[k] + 1;
        const dist = Math.min(fromTop, fromBottom);
        if (dist < extremeDist) {
          extremeDist = dist;
          formExtremeType = fromTop <= fromBottom ? "best" : "worst";
          formHighlights.clear();
          formHighlights.add(`${p}:${k}`);
        } else if (dist === extremeDist) {
          formHighlights.add(`${p}:${k}`);
        }
      }
    }
  }

  const deltaLabel = teamForm
    ? teamForm.deltaPts > 0
      ? "above expected"
      : teamForm.deltaPts < 0
        ? "below expected"
        : "on par"
    : null;
  const pageUrl = absoluteUrl(`/teams/${clubId}`);
  const leaguePath = getLeagueUrl(league);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: `${name} squad, form and injury report`,
        description: `${name} football analytics and squad report for ${league}.`,
        mainEntity: { "@id": `${pageUrl}#team` },
      },
      {
        "@type": "SportsTeam",
        "@id": `${pageUrl}#team`,
        name,
        url: pageUrl,
        sport: "Association football",
        ...(logoUrl ? { logo: logoUrl, image: logoUrl } : {}),
        ...(clubUrl ? { sameAs: clubUrl } : {}),
        memberOf: {
          "@type": "SportsOrganization",
          name: league,
          ...(leaguePath ? { url: absoluteUrl(leaguePath) } : {}),
        },
        additionalProperty: [
          ...(teamForm && teamForm.points > 0
            ? [
                {
                  "@type": "PropertyValue",
                  name: "League position",
                  value: teamForm.leaguePosition,
                },
                {
                  "@type": "PropertyValue",
                  name: "Points",
                  value: teamForm.points,
                },
              ]
            : []),
          {
            "@type": "PropertyValue",
            name: "Squad market value",
            value: formatMarketValue(data.squadValue),
          },
          {
            "@type": "PropertyValue",
            name: "Tracked players",
            value: squad.length,
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Team rankings",
            item: absoluteUrl("/expected-position"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  return (
    <DetailPageShell backHref="/expected-position" backLabel="Back to team rankings">
      <JsonLd data={jsonLd} />
      <DetailHero>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[1.5rem] border border-border-medium bg-white p-3 sm:h-28 sm:w-28">
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-3xl text-text-muted">?</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <LeagueBadge league={league} />
              {teamForm && teamForm.deltaPts > 0 && (
                <Badge className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
                  Overperforming
                </Badge>
              )}
              {teamForm && teamForm.deltaPts < 0 && (
                <Badge className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs text-red-400">
                  Underperforming
                </Badge>
              )}
              {formPresence.some((f) => f.type === "top") && (
                <Badge className="rounded-full border border-accent-hot-border bg-accent-hot-glow px-3 py-1 text-xs text-accent-hot">
                  Form leader
                </Badge>
              )}
              {/* What the summer came to, and any club table this club heads.
                  Streamed: the crest and the name should not wait on a transfer
                  scrape. */}
              <Suspense>
                <ClubWindowBadges clubId={clubId} />
              </Suspense>
            </div>

            <h1 className="mt-4 text-3xl font-pixel leading-tight text-text-primary sm:text-4xl">
              {name}
            </h1>

            <ManagerClient clubId={clubId} />

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="outline"
                className="border-border-medium bg-elevated text-text-primary hover:bg-card-hover"
              >
                <Link href={`/players?club=${encodeURIComponent(squad[0]?.club ?? name)}`}>
                  Filter in Players
                </Link>
              </Button>
              {clubUrl && (
                <Button
                  asChild
                  variant="outline"
                  className="border-border-medium bg-elevated text-text-primary hover:bg-card-hover"
                >
                  <a href={clubUrl} target="_blank" rel="noopener noreferrer">
                    Transfermarkt
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div
          className={`grid gap-x-8 gap-y-5 ${teamForm ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}
        >
          {teamForm && (
            <HeroMetric
              label="League position"
              value={ordinal(teamForm.leaguePosition)}
              subline={`${teamForm.points} pts · expected ${ordinal(teamForm.marketValueRank)}`}
              accentClass="text-text-primary"
            />
          )}
          {teamForm && (
            <HeroMetric
              label="Points gap"
              value={teamForm.deltaPts > 0 ? `+${teamForm.deltaPts}` : String(teamForm.deltaPts)}
              subline={deltaLabel ?? ""}
              accentClass={
                teamForm.deltaPts > 0
                  ? "text-emerald-400"
                  : teamForm.deltaPts < 0
                    ? "text-red-400"
                    : "text-text-primary"
              }
            />
          )}
          {teamForm && (
            <HeroMetric
              label="Avg. squad value"
              value={teamForm.marketValue}
              subline={`${ordinal(teamForm.marketValueRank)} by squad value`}
              accentClass="text-accent-gold"
            />
          )}
        </div>

        <div className="col-span-full flex flex-wrap gap-2.5 empty:hidden">
          {worstHit.reason &&
            clubInjuries.length > 0 &&
            (() => {
              const injuryValue = clubInjuries.reduce((s, p) => s + p.marketValueNum, 0);
              const scopeLabel = worstHit.scope === "top5" ? "in top 5 leagues" : "in league";
              const label =
                worstHit.reason === "count" || worstHit.reason === "both"
                  ? `Most injuries ${scopeLabel} · ${clubInjuries.length} out · ${formatMarketValue(injuryValue)}`
                  : `Most value sidelined ${scopeLabel} · ${formatMarketValue(injuryValue)} · ${clubInjuries.length} out`;
              return (
                <Badge className="rounded-full border border-accent-cold-border bg-accent-cold-glow px-3 py-1 text-xs text-accent-cold-soft">
                  {label}
                </Badge>
              );
            })()}
          {trendPlayers.map((tp) => (
            <Link key={tp.player.playerId} href={getPlayerDetailHref(tp.player.playerId)}>
              <Badge
                className={`rounded-full border px-3 py-1 text-xs transition-colors hover:brightness-125 ${
                  tp.type === "winner"
                    ? "border-accent-hot-border bg-accent-hot-glow text-accent-hot"
                    : "border-accent-cold-border bg-accent-cold-glow text-accent-cold-soft"
                }`}
              >
                {tp.type === "winner" ? (
                  <TrendingUp className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="mr-1 h-3.5 w-3.5" />
                )}
                {tp.player.name} · {tp.appearances.length}{" "}
                {tp.type === "winner" ? "rises" : "drops"}
              </Badge>
            </Link>
          ))}
          {formPresence.map((fp) => (
            <Link key={`${fp.type}-${fp.category}`} href="/form">
              <Badge
                className={`rounded-full border px-3 py-1 text-xs transition-colors hover:brightness-125 ${
                  fp.type === "top"
                    ? "border-accent-hot-border bg-accent-hot-glow text-accent-hot"
                    : "border-accent-cold-border bg-accent-cold-glow text-accent-cold-soft"
                }`}
              >
                {fp.type === "top" ? "↑" : "↓"} {fp.category} · last {fp.periods.join(", ")}
              </Badge>
            </Link>
          ))}
        </div>
      </DetailHero>

      <DetailDeck
        sections={[
          { value: "form", label: "Recent Form" },
          { value: "squad", label: "Squad" },
          { value: "transfers", label: "Transfers" },
          { value: "value", label: "Value Analysis" },
          { value: "injuries", label: "Injuries" },
        ]}
      >
        {/* Tab 1: Recent Form */}
        <div>
          {recentForm.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-elevated px-4 py-6 text-sm text-text-secondary">
              No recent form data available for this team.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Form table across windows */}
              <div className="overflow-x-auto rounded-xl border border-border-subtle">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle bg-black/20 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                      <th className="px-3 py-2 text-left font-normal">
                        Window{" "}
                        <span className="text-text-secondary">
                          / {recentForm[0]?.totalTeams ?? ""} top-5 league teams
                        </span>
                      </th>
                      <th className="px-3 py-2 text-right font-normal">W</th>
                      <th className="px-3 py-2 text-right font-normal">D</th>
                      <th className="px-3 py-2 text-right font-normal">L</th>
                      <th className="px-3 py-2 text-right font-normal">Pts</th>
                      <th className="px-3 py-2 text-right font-normal">GF</th>
                      <th className="px-3 py-2 text-right font-normal">GA</th>
                      <th className="px-3 py-2 text-right font-normal">GD</th>
                      <th className="hidden sm:table-cell px-3 py-2 text-right font-normal">PPG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentForm.map(({ period, stats, ranks, totalTeams }) => {
                      const games = stats.wins + stats.draws + stats.losses;
                      const ppg = games > 0 ? (stats.points / games).toFixed(2) : "—";
                      const cellHighlight = (key: string) => {
                        if (!formHighlights.has(`${period}:${key}`)) return "";
                        return formExtremeType === "best" ? "bg-emerald-500/10" : "bg-red-500/10";
                      };
                      const rankLabel = (r: number) => {
                        const fromBottom = totalTeams - r + 1;
                        const isTop = r <= 3;
                        const isBottom = fromBottom <= 3;
                        const color = isTop
                          ? "text-emerald-400"
                          : isBottom
                            ? "text-red-400"
                            : "text-text-secondary";
                        const label =
                          r === 1
                            ? "best"
                            : fromBottom === 1
                              ? "worst"
                              : isTop
                                ? ordinal(r)
                                : isBottom
                                  ? `${ordinal(fromBottom)} worst`
                                  : `#${r}`;
                        return (
                          <span className={`ml-1.5 text-[11px] ${color}`}>
                            {r === 1 && <Crown className="mr-0.5 inline h-2.5 w-2.5" />}
                            {isTop && r > 1 && <Medal className="mr-0.5 inline h-2.5 w-2.5" />}
                            {isBottom && <TriangleAlert className="mr-0.5 inline h-2.5 w-2.5" />}
                            {label}
                          </span>
                        );
                      };
                      return (
                        <tr key={period} className="border-b border-border-subtle/50 last:border-0">
                          <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                            Last {period}
                          </td>
                          <td className="px-3 py-2.5 text-right font-value text-text-primary">
                            {stats.wins}
                          </td>
                          <td className="px-3 py-2.5 text-right font-value text-text-primary">
                            {stats.draws}
                          </td>
                          <td className="px-3 py-2.5 text-right font-value text-text-primary">
                            {stats.losses}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-value text-accent-blue whitespace-nowrap transition-colors ${cellHighlight("points")}`}
                          >
                            {stats.points}
                            {rankLabel(ranks.points)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-value text-text-primary whitespace-nowrap transition-colors ${cellHighlight("goalsScored")}`}
                          >
                            {stats.goalsScored}
                            {rankLabel(ranks.goalsScored)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-value text-text-primary whitespace-nowrap transition-colors ${cellHighlight("goalsConceded")}`}
                          >
                            {stats.goalsConceded}
                            {rankLabel(ranks.goalsConceded)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-value whitespace-nowrap transition-colors ${stats.goalDiff > 0 ? "text-emerald-400" : stats.goalDiff < 0 ? "text-red-400" : "text-text-primary"} ${cellHighlight("goalDiff")}`}
                          >
                            {stats.goalDiff > 0 ? "+" : ""}
                            {stats.goalDiff}
                            {rankLabel(ranks.goalDiff)}
                          </td>
                          <td className="hidden sm:table-cell px-3 py-2.5 text-right font-value text-text-secondary">
                            {ppg}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Form presence badges */}
              {formPresence.length > 0 && (
                <SectionPanel
                  title="Category leaders"
                  aside={
                    <Link
                      href="/form"
                      className="text-xs text-text-secondary transition-colors hover:text-text-primary"
                    >
                      Full form analysis &rarr;
                    </Link>
                  }
                >
                  <div className="flex flex-wrap gap-2">
                    {formPresence.map((fp) => (
                      <div
                        key={`${fp.type}-${fp.category}`}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          fp.type === "top"
                            ? "border-accent-hot/25 bg-accent-hot-glow text-accent-hot"
                            : "border-accent-cold/25 bg-accent-cold-glow text-accent-cold-soft"
                        }`}
                      >
                        <span className="font-medium">
                          {fp.type === "top" ? "↑" : "↓"} {fp.category}
                        </span>
                        <span className="ml-1.5 opacity-60">in last {fp.periods.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </SectionPanel>
              )}
            </div>
          )}
        </div>

        {/* Tab 2: Squad */}
        <SquadTab squad={slimForClient(squad)} />

        {/* Tab 3: Transfers */}
        <TransfersTab clubId={clubId} name={name} />

        {/* Tab 4: Value Analysis */}
        <div className="space-y-8">
          <SectionPanel
            title={`Bargains at ${name} (${overperformers.length})`}
            aside={
              <Link
                href="/value-analysis?mode=ga&dTab=bargains"
                className="text-xs text-text-secondary transition-colors hover:text-text-primary"
              >
                Full analysis &rarr;
              </Link>
            }
          >
            {overperformers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-subtle bg-elevated px-4 py-6 text-sm text-text-secondary">
                No club players currently outperform 3+ pricier comparable peers.
              </div>
            ) : (
              <div className="space-y-3">
                {overperformers.map((p) => (
                  <ComparisonItem key={p.playerId} player={p} positive count={p.count} />
                ))}
              </div>
            )}
          </SectionPanel>

          <SectionPanel
            title={`Overpriced at ${name} (${underperformers.length})`}
            aside={
              <Link
                href="/value-analysis?mode=ga"
                className="text-xs text-text-secondary transition-colors hover:text-text-primary"
              >
                Full analysis &rarr;
              </Link>
            }
          >
            {underperformers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-subtle bg-elevated px-4 py-6 text-sm text-text-secondary">
                No club players are currently outperformed by 3+ cheaper comparable peers.
              </div>
            ) : (
              <div className="space-y-3">
                {underperformers.map((p) => (
                  <ComparisonItem key={p.playerId} player={p} positive={false} count={p.count} />
                ))}
              </div>
            )}
          </SectionPanel>
        </div>

        {/* Tab 5: Injuries */}
        <div>
          {clubInjuries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-elevated px-4 py-6 text-sm text-text-secondary">
              No injured players currently tracked for this team.
            </div>
          ) : (
            <div className="space-y-3">
              {clubInjuries.map((p) => (
                <InjuredPlayerRow key={p.profileUrl || p.name} player={p} />
              ))}
            </div>
          )}
        </div>
      </DetailDeck>
    </DetailPageShell>
  );
}
