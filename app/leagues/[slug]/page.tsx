import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import type { AnalysisResult, InjuredPlayer } from "@/app/types";
import { Button } from "@/components/ui/button";
import { DetailHero, DetailPageShell } from "@/components/DetailHero";
import { HeroMetric } from "@/components/HeroMetric";
import { InjuredPlayerCard } from "@/components/InjuredPlayerCard";
import { StandingsTable, type FormLeader } from "./StandingsTable";
import { AggregatedFormCard } from "@/app/components/FormAnalysisUI";
import { SquadTab } from "@/app/teams/[clubId]/SquadTab";
import { createPageMetadata } from "@/lib/metadata";
import {
  LEAGUES,
  getLeagueBySlug,
  getLeagueLogoUrl,
  getTransfermarktLeagueUrl,
  isSameLeague,
} from "@/lib/leagues";
import { getTeamFormData } from "@/lib/team-form";
import { getLeagueAnalysis } from "@/lib/form-analysis";
import { getMinutesValueData, slimForClient } from "@/lib/fetch-minutes-value";
import { getInjuredPlayers } from "@/lib/injured";
import { formatMarketValue } from "@/lib/format";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site-config";
import { EmptyNote } from "@/components/EmptyNote";

// Request-rendered like every other Transfermarkt-backed page: prerendering
// this at build meant live team-form/form-analysis fetches whose retry ladders
// blow the 60s static-generation timeout whenever TM is down, failing deploys.
// The data layer underneath is unstable_cache'd, so request renders stay cheap.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const league = getLeagueBySlug(slug);
  if (!league) {
    return createPageMetadata({
      title: "League",
      description: "Form, expected position, top players, and injuries for one league.",
      path: `/leagues/${slug}`,
      noIndex: true,
    });
  }
  return createPageMetadata({
    title: `${league.name} Table, Form, Player Stats & Injuries`,
    description: `${league.name} standings and squad-value expectations, recent team form, top players by non-penalty goals plus assists, and the latest injury impact data.`,
    path: `/leagues/${slug}`,
    keywords: [
      league.name,
      `${league.name} table`,
      `${league.name} player stats`,
      `${league.name} form`,
      `${league.name} top scorers`,
      `${league.name} injuries`,
      `${league.name} expected position`,
    ],
  });
}

function SectionHeader({
  title,
  subtitle,
  linkHref,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-xl font-pixel font-bold text-text-primary sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
      </div>
      <Link
        href={linkHref}
        className="text-sm font-medium text-accent-blue hover:underline whitespace-nowrap"
      >
        {linkLabel} →
      </Link>
    </header>
  );
}

function EmptySection({ children }: { children: React.ReactNode }) {
  return <EmptyNote>{children}</EmptyNote>;
}

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = getLeagueBySlug(slug);
  if (!league) notFound();

  // TM-backed fetches (form analysis, standings, injuries) can fail when TM's
  // WAF blocks the prerender. Render whatever sections we have rather than
  // failing the build — caches recover on the next live request.
  const emptyAnalysis: AnalysisResult = {
    success: false,
    matchedPeriod: null,
    analysis: [],
    aggregatedTop: [],
    aggregatedBottom: [],
  };
  const emptyTeamForm = { success: false as const, allTeams: [], leagues: [] };
  const [teamFormData, leagueAnalysis, allPlayers, injuredData] = await Promise.all([
    getTeamFormData().catch(() => emptyTeamForm),
    getLeagueAnalysis(league.name).catch(() => emptyAnalysis),
    getMinutesValueData(),
    getInjuredPlayers().catch(() => ({ players: [] as InjuredPlayer[] })),
  ]);

  const inLeague = (name: string) => isSameLeague(name, league.name);
  const leagueTeams = teamFormData.allTeams.filter((t) => inLeague(t.league));
  const leaguePlayers = allPlayers.filter((p) => inLeague(p.league));
  const leagueInjured = (injuredData.players ?? []).filter((p) => inLeague(p.league));

  const topTier = (teams: typeof leagueAnalysis.aggregatedTop) =>
    teams.length === 0 ? teams : teams.filter((t) => t.count === teams[0].count);
  const aggregatedTop = topTier(leagueAnalysis.aggregatedTop);
  const aggregatedBottom = topTier(leagueAnalysis.aggregatedBottom);
  const hasFormLeaders = aggregatedTop.length > 0 || aggregatedBottom.length > 0;

  const formLeaders: Record<string, FormLeader> = {};
  for (const t of aggregatedTop) formLeaders[t.clubId] = { type: "top", count: t.count };
  for (const t of aggregatedBottom) formLeaders[t.clubId] = { type: "bottom", count: t.count };

  const deltaMap: Record<string, number> = {};
  for (const t of leagueTeams) deltaMap[t.clubId] = t.deltaPts;

  const totalInjuredValue = leagueInjured.reduce((s, p) => s + p.marketValueNum, 0);
  const topInjured = leagueInjured.slice(0, 10);

  const tmUrl = getTransfermarktLeagueUrl(league.name);
  const logoUrl = getLeagueLogoUrl(league.name);
  const trackedPlayers = leaguePlayers.length;
  const teamCount = leagueTeams.length;
  const pageUrl = absoluteUrl(`/leagues/${league.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageUrl,
        url: pageUrl,
        name: `${league.name} table, form, player stats and injuries`,
        description: `${league.name} football analytics dashboard with standings, form, player output and injury impact.`,
        mainEntity: { "@id": `${pageUrl}#league` },
      },
      {
        "@type": "SportsOrganization",
        "@id": `${pageUrl}#league`,
        name: league.name,
        url: pageUrl,
        sport: "Association football",
        ...(logoUrl ? { logo: logoUrl, image: logoUrl } : {}),
        ...(tmUrl ? { sameAs: tmUrl } : {}),
        member: leagueTeams.map((team) => ({
          "@type": "SportsTeam",
          name: team.name,
          url: absoluteUrl(`/teams/${team.clubId}`),
          ...(team.logoUrl ? { logo: team.logoUrl } : {}),
        })),
        additionalProperty: [
          { "@type": "PropertyValue", name: "Teams", value: teamCount },
          {
            "@type": "PropertyValue",
            name: "Tracked players",
            value: trackedPlayers,
          },
          {
            "@type": "PropertyValue",
            name: "Players currently injured",
            value: leagueInjured.length,
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: league.name,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  return (
    <DetailPageShell backHref="/" backLabel="Back to home">
      <JsonLd data={jsonLd} />
      <DetailHero>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[1.5rem] border border-border-medium bg-white p-3 sm:h-28 sm:w-28">
            {logoUrl ? (
              <img src={logoUrl} alt={league.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-3xl text-text-muted">?</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-pixel font-bold text-3xl leading-tight text-text-primary sm:text-4xl">
              {league.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="outline"
                className="border-border-medium bg-elevated text-text-primary hover:bg-card-hover"
              >
                <Link href={`/players?league=${encodeURIComponent(league.name)}`}>
                  Players in {league.name}
                </Link>
              </Button>
              {tmUrl && (
                <Button
                  asChild
                  variant="outline"
                  className="border-border-medium bg-elevated text-text-primary hover:bg-card-hover"
                >
                  <a href={tmUrl} target="_blank" rel="noopener noreferrer">
                    Transfermarkt
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <HeroMetric
            label="Teams"
            value={String(teamCount)}
            subline="in standings"
            accentClass="text-text-primary"
          />
          <HeroMetric
            label="Tracked players"
            value={String(trackedPlayers)}
            subline="active in dataset"
            accentClass="text-accent-blue"
          />
          <HeroMetric
            label="Injured value"
            value={leagueInjured.length > 0 ? formatMarketValue(totalInjuredValue) : "—"}
            subline={`${leagueInjured.length} ${leagueInjured.length === 1 ? "player" : "players"} sidelined`}
            accentClass="text-accent-hot"
          />
        </div>

        <nav
          className="lg:col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-subtle pt-5 text-xs"
          aria-label="Switch league"
        >
          <span className="uppercase tracking-[0.18em] text-text-muted">Switch league</span>
          {LEAGUES.filter((l) => l.slug !== league.slug).map((l) => {
            const otherLogo = getLeagueLogoUrl(l.name);
            return (
              <Link
                key={l.slug}
                href={`/leagues/${l.slug}`}
                className="inline-flex items-center gap-1.5 text-text-secondary transition-colors hover:text-text-primary hover:underline"
              >
                {otherLogo && (
                  <img
                    src={otherLogo}
                    alt=""
                    className="h-4 w-4 rounded-sm bg-white/90 object-contain p-px"
                  />
                )}
                {l.name}
              </Link>
            );
          })}
        </nav>
      </DetailHero>

      <div className="mt-14 grid gap-12 sm:mt-16 xl:grid-cols-[1.15fr_1fr] xl:gap-10">
        <section className="min-w-0">
          <SectionHeader
            title="Standings"
            subtitle={`${league.name} table — sort by position, market value, or points gap vs squad-value expectation.`}
            linkHref="/expected-position"
            linkLabel="All top 5 leagues"
          />
          {leagueTeams.length > 0 ? (
            <StandingsTable teams={leagueTeams} formLeaders={formLeaders} />
          ) : (
            <EmptySection>No standings data available for this league yet.</EmptySection>
          )}
        </section>

        <section className="min-w-0">
          <SectionHeader
            title="Top players"
            subtitle="Top 10 by npG+A — toggle to sort by value, mins, games, or pens."
            linkHref={`/players?league=${encodeURIComponent(league.name)}`}
            linkLabel={`See all ${trackedPlayers}`}
          />
          <SquadTab
            squad={slimForClient(leaguePlayers, { trimRecentForm: true })}
            defaultSort="ga"
            limit={10}
            showClub
            emptyLabel={`No tracked players in ${league.name}.`}
          />
        </section>
      </div>

      <section className="mt-12 sm:mt-14">
        <SectionHeader
          title="Recent form"
          subtitle="Teams leading or trailing the most categories across last 5, 10, 15, and 20 matches."
          linkHref="/form"
          linkLabel="All top 5 leagues"
        />
        {hasFormLeaders ? (
          <AggregatedFormCard top={aggregatedTop} bottom={aggregatedBottom} deltaMap={deltaMap} />
        ) : (
          <EmptySection>
            No team in {league.name} dominates 2+ categories across any window right now.
          </EmptySection>
        )}
      </section>

      {topInjured.length > 0 && (
        <section className="mt-14 sm:mt-16">
          <SectionHeader
            title="Injury report"
            subtitle={
              leagueInjured.length > topInjured.length
                ? `Top ${topInjured.length} of ${leagueInjured.length} most valuable players sidelined.`
                : `${topInjured.length} ${topInjured.length === 1 ? "player" : "players"} currently sidelined.`
            }
            linkHref={`/injured?league=${encodeURIComponent(league.name)}`}
            linkLabel={`See all ${leagueInjured.length}`}
          />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {topInjured.map((player, idx) => (
              <InjuredPlayerCard
                key={`${player.name}-${player.club}-${idx}`}
                player={player}
                rank={idx + 1}
                index={idx}
                showLeague={false}
              />
            ))}
          </div>
        </section>
      )}
    </DetailPageShell>
  );
}
