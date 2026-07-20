import Link from "next/link";
import { createPageMetadata } from "@/lib/metadata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Scale, Clock, TrendingUp, HeartPulse, ArrowUpDown } from "lucide-react";

export const metadata = createPageMetadata({
  title: "How It Works",
  description:
    "How SquadStat calculates form, value gaps, player output, and injury impact across Europe's top 5 leagues.",
  path: "/how-it-works",
  keywords: ["football analytics methodology", "form calculation", "expected position"],
});

function Section({
  icon: Icon,
  title,
  href,
  iconColor,
  children,
}: {
  icon: typeof Activity;
  title: string;
  href: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border-subtle bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-elevated`}
          >
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </span>
          <div>
            <CardTitle className="text-xl text-text-primary">{title}</CardTitle>
            <Link
              href={href}
              className="text-sm text-accent-blue hover:text-text-primary transition-colors"
            >
              Open page
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed text-text-secondary">
        {children}
      </CardContent>
    </Card>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return <strong className="text-text-primary">{children}</strong>;
}

export default function HowItWorksPage() {
  return (
    <div className="pb-16 sm:pb-20">
      <div className="mb-8 sm:mb-10">
        <h1 className="text-3xl font-pixel text-text-primary sm:text-4xl">How It Works</h1>
        <p className="mt-3 max-w-3xl text-sm text-text-secondary sm:text-base">
          SquadStat pulls data from Transfermarkt and runs calculations to surface form trends,
          value gaps, and injury cost. Here is how each page works.
        </p>
      </div>

      <div className="space-y-6">
        {/* Recent Form */}
        <Section icon={Activity} title="Recent Form" href="/form" iconColor="text-accent-hot">
          <div>
            <h3 className="font-semibold text-text-primary mb-1">What it shows</h3>
            <p>
              Which teams are on the hottest or coldest streaks right now, based on actual match
              results (all competitions, not just league games).
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Form windows</h3>
            <p>
              We look at 4 time frames: a team&apos;s <Term>last 5, 10, 15, and 20 matches</Term>.
              Shorter windows catch recent momentum shifts; longer ones reveal sustained trends.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Categories</h3>
            <p>Within each window, teams are ranked on 4 categories:</p>
            <ul className="mt-1.5 ml-4 list-disc space-y-1">
              <li>
                <Term>Points</Term> — 3 for a win, 1 for a draw, 0 for a loss
              </li>
              <li>
                <Term>Goal difference</Term> — goals scored minus goals conceded
              </li>
              <li>
                <Term>Goals scored</Term> — total attacking output
              </li>
              <li>
                <Term>Goals conceded</Term> — defensive record (fewest is best)
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">
              How &ldquo;Best/Worst Form&rdquo; is determined
            </h3>
            <p>
              A team must lead (or trail) <Term>2 or more categories</Term> within at least one
              window to appear. We then count how many total category appearances each team has
              across all 4 windows and rank by that count. The team with the most is the form
              leader.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Manager context</h3>
            <p>
              <Term>PPG (Points Per Game)</Term> is the manager&apos;s average points per match at
              this club. The ranking (e.g. &ldquo;2/7&rdquo;) compares them to all managers at the
              same club with a similar number of games, going back to 1992.
            </p>
          </div>
        </Section>

        {/* Value vs Table */}
        <Section
          icon={Scale}
          title="Value vs Table"
          href="/expected-position"
          iconColor="text-accent-blue"
        >
          <div>
            <h3 className="font-semibold text-text-primary mb-1">What it shows</h3>
            <p>
              Whether teams are punching above or below their financial weight. A club with the 2nd
              most expensive squad should, in theory, finish 2nd — but reality rarely matches.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">
              How &ldquo;points gap&rdquo; is calculated
            </h3>
            <ol className="mt-1.5 ml-4 list-decimal space-y-1">
              <li>
                Rank all teams in a league by <Term>total squad market value</Term> (most expensive
                = 1st).
              </li>
              <li>
                For each team, look at which league position their value rank corresponds to and
                note how many points that position currently has. This is the{" "}
                <Term>expected points</Term>.
              </li>
              <li>
                <Term>Points gap</Term> = actual points &minus; expected points.
              </li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Reading the numbers</h3>
            <ul className="mt-1.5 ml-4 list-disc space-y-1">
              <li>
                <Term>+8 points gap</Term> — the team has 8 more points than their squad value would
                predict (overperforming)
              </li>
              <li>
                <Term>-5 points gap</Term> — the team has 5 fewer points than expected
                (underperforming)
              </li>
              <li>
                <Term>&ldquo;Squad ranked 3rd, 58pts expected&rdquo;</Term> — this team has the 3rd
                most valuable squad, and the team currently in 3rd place has 58 points
              </li>
            </ul>
          </div>
        </Section>

        {/* Player Explorer */}
        <Section icon={Clock} title="Player Explorer" href="/players" iconColor="text-accent-gold">
          <div>
            <h3 className="font-semibold text-text-primary mb-1">What it shows</h3>
            <p>
              500+ elite players across Europe&apos;s top 5 leagues with detailed stats, filterable
              by league, club, nationality, position, and more.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Key stats</h3>
            <ul className="mt-1.5 ml-4 list-disc space-y-1">
              <li>
                <Term>G+A (excl. pens)</Term> — goals + assists, excluding penalty goals. Shown as{" "}
                <Term>npG+A</Term> in compact views. This better reflects open-play contribution.
              </li>
              <li>
                <Term>Form window (Last 5 / Last 10)</Term> — stats from only the player&apos;s most
                recent 5 or 10 matches, useful for spotting current form vs. season-long totals.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Sorting</h3>
            <p>
              Sort by value, minutes played, games, goals+assists, penalties, or missed games. When
              sorting by G+A, ties are broken by fewer minutes (more efficient players rank higher).
            </p>
          </div>
        </Section>

        {/* Over/Under */}
        <Section
          icon={TrendingUp}
          title="Over/Under"
          href="/value-analysis"
          iconColor="text-emerald-400"
        >
          <div>
            <h3 className="font-semibold text-text-primary mb-1">What it shows</h3>
            <p>
              Finds players who are either expensive but outperformed by cheaper alternatives, or
              cheap but outperforming more expensive peers.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">G+A output mode</h3>
            <p>
              Compares players in similar attacking positions. A player is flagged as{" "}
              <Term>overpriced</Term> if 3 or more cheaper players have produced equal or better
              non-penalty goals + assists in equal or fewer minutes. Conversely, a{" "}
              <Term>bargain</Term> player outproduces 3+ more expensive peers.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Minutes mode</h3>
            <p>
              Shows high-value players getting the fewest minutes — potential wasted investment or
              squad depth issues.
            </p>
            <p className="mt-1.5">
              <Term>Missed %</Term> is the percentage of total team matches the player has been
              unavailable for (injury, suspension, etc.). Use the missed-% filters to exclude
              heavily injured players and focus on fit players who simply aren&apos;t getting
              minutes.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">
              &ldquo;Outscored by N cheaper players&rdquo;
            </h3>
            <p>
              This count shows how many less expensive players in comparable positions have matched
              or beaten this player&apos;s output. A higher number means more evidence the player is
              underdelivering relative to cost.
            </p>
          </div>
        </Section>

        {/* Injury Impact */}
        <Section
          icon={HeartPulse}
          title="Injury Impact"
          href="/injured"
          iconColor="text-accent-cold"
        >
          <div>
            <h3 className="font-semibold text-text-primary mb-1">What it shows</h3>
            <p>
              Currently injured players across all 5 leagues, with their market value, injury type,
              and expected return date. Three views: by player, by club (total value sidelined), and
              by injury type.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Club impact</h3>
            <p>
              The &ldquo;Teams&rdquo; tab sums the market value of all injured players at each club.
              This shows which clubs are carrying the heaviest injury burden in financial terms.
            </p>
          </div>
        </Section>

        {/* Biggest Movers */}
        <Section
          icon={ArrowUpDown}
          title="Biggest Movers"
          href="/biggest-movers"
          iconColor="text-violet-400"
        >
          <div>
            <h3 className="font-semibold text-text-primary mb-1">What it shows</h3>
            <p>
              Players whose Transfermarkt market value has been{" "}
              <Term>consistently rising or falling</Term> across multiple valuation updates — not
              one-off jumps, but sustained trends.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">How it works</h3>
            <p>
              We look at consecutive market value changes. Transfermarkt updates values periodically
              throughout the season. A player appears as a &ldquo;biggest riser&rdquo; if their
              value has increased in multiple consecutive updates, and as a &ldquo;biggest
              faller&rdquo; if it has dropped repeatedly. Ranked by total absolute change.
            </p>
          </div>
        </Section>

        {/* Data source */}
        <Card className="border-border-subtle bg-elevated">
          <CardContent className="py-6 text-sm text-text-muted">
            <p>
              All data is sourced from{" "}
              <a
                href="https://www.transfermarkt.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-blue hover:text-text-primary transition-colors"
              >
                Transfermarkt
              </a>
              . Market values, squad data, match results, injuries, and manager histories are
              refreshed regularly. Use the refresh button in the header to pull the latest data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
