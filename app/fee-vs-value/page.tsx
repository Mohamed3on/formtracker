import Link from "next/link";
import { getFeeVsValueData, rank } from "@/lib/fee-vs-value";
import { formatMarketValue, getTeamDetailHref } from "@/lib/format";
import { createPageMetadata } from "@/lib/metadata";
import { DataLastUpdated } from "@/app/components/DataLastUpdated";
import { SectionPanel } from "@/components/SectionPanel";
import { ClubLogo } from "@/components/ClubLogo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HeadlineCard } from "./HeadlineCard";
import { Leaderboard } from "./Leaderboard";
import { formatPremium, formatRatio, TransferRow } from "./TransferRow";

export const metadata = createPageMetadata({
  title: "Fee vs Value",
  description:
    "Which clubs paid over the odds and which got a bargain in the season's 100 biggest transfers. Every fee held up against the player's Transfermarkt market value, in cash and times value.",
  path: "/fee-vs-value",
  keywords: [
    "most overpriced transfer",
    "transfer fee vs market value",
    "biggest transfer bargains",
    "overpaid football transfers",
    "transfer premium analysis",
  ],
});

function SummaryStat({
  label,
  value,
  sub,
  accentClass = "text-text-primary",
}: {
  label: string;
  value: string;
  sub: string;
  accentClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={cn("mt-1.5 font-value text-xl leading-none sm:text-2xl", accentClass)}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-text-secondary">{sub}</p>
    </div>
  );
}

const HEADLINES = [
  {
    side: "over" as const,
    cash: {
      label: "Biggest overpay — cash",
      hint: "The widest gap in euros between what a club paid and what the player was worth.",
    },
    times: {
      label: "Biggest overpay — times value",
      hint: "The fee that covers the player's value the most times over. Smaller deals win this one.",
    },
    both: {
      label: "Biggest overpay — cash and times value",
      hint: "One deal took both: the widest gap in euros and the most times over the player's value.",
    },
  },
  {
    side: "under" as const,
    cash: {
      label: "Biggest bargain — cash",
      hint: "The most value a buyer picked up below the asking price.",
    },
    times: {
      label: "Biggest bargain — times value",
      hint: "The lowest fee next to what the player was worth — cents on the euro.",
    },
    both: {
      label: "Biggest bargain — cash and times value",
      hint: "One deal took both: the most value off the asking price, and the lowest fee next to it.",
    },
  },
];

/** The two deals topping a side, plus whether they're the same one. Cash and
 *  times value normally crown different players; a sweep is a real finding and
 *  gets one card carrying both figures instead of two identical ones. */
function headlineWinners(ranked: ReturnType<typeof rank>, side: "over" | "under") {
  const cash = side === "over" ? ranked.overpaidAbsolute[0] : ranked.underpaidAbsolute[0];
  const times = side === "over" ? ranked.overpaidRatio[0] : ranked.underpaidRatio[0];
  return { cash, times, sweep: Boolean(cash && times && cash.playerId === times.playerId) };
}

export default async function FeeVsValuePage() {
  const data = await getFeeVsValueData();
  const ranked = rank(data.paid);
  const { totals } = data;

  const overpayers = data.clubs.filter((c) => c.premium > 0).slice(0, 5);
  const bargainHunters = data.clubs
    .filter((c) => c.premium < 0)
    .slice()
    .reverse()
    .slice(0, 5);

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {HEADLINES.map(({ side, cash, times, both }) => {
          const winners = headlineWinners(ranked, side);
          return winners.sweep ? (
            <HeadlineCard
              key={side}
              label={both.label}
              hint={both.hint}
              transfer={winners.cash}
              metrics={["premium", "ratio"]}
              tone={side}
              className="lg:col-span-2"
            />
          ) : (
            [
              <HeadlineCard
                key={`${side}-cash`}
                label={cash.label}
                hint={cash.hint}
                transfer={winners.cash}
                metrics={["premium"]}
                tone={side}
              />,
              <HeadlineCard
                key={`${side}-times`}
                label={times.label}
                hint={times.hint}
                transfer={winners.times}
                metrics={["ratio"]}
                tone={side}
              />,
            ]
          );
        })}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:p-5">
          <SummaryStat
            label="Total spent"
            value={formatMarketValue(totals.fees)}
            sub={`across ${data.paid.length} deals with a fee`}
          />
          <SummaryStat
            label="What they're worth"
            value={formatMarketValue(totals.marketValue)}
            sub="those same players, added up"
          />
          <SummaryStat
            label="Paid over the odds"
            value={formatPremium(totals.premium)}
            sub="spent above their value"
            accentClass={totals.premium > 0 ? "text-accent-cold" : "text-accent-hot"}
          />
          <SummaryStat
            label="Times their value"
            value={formatRatio(totals.ratio)}
            sub="what the market paid"
            accentClass={totals.ratio > 1 ? "text-accent-cold" : "text-accent-hot"}
          />
        </CardContent>
      </Card>

      <Leaderboard ranked={ranked} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionPanel title="Clubs that paid over the odds">
          <ClubTable rows={overpayers} tone="over" />
        </SectionPanel>
        <SectionPanel title="Clubs that found bargains">
          <ClubTable rows={bargainHunters} tone="under" />
        </SectionPanel>
      </div>

      {data.free.length > 0 && (
        <SectionPanel
          title="Free transfers"
          aside={
            <span className="text-xs text-text-muted">
              nothing paid, so nothing to compare — kept out of the lists above
            </span>
          }
        >
          <ol className="space-y-2">
            {data.free.map((t) => (
              <TransferRow
                key={t.playerId}
                transfer={t}
                tone="under"
                metric={formatMarketValue(t.marketValue)}
                metricLabel="walked for nothing"
              />
            ))}
          </ol>
        </SectionPanel>
      )}

      {data.loans.length > 0 && (
        <SectionPanel
          title="Loans"
          aside={
            <span className="text-xs text-text-muted">
              Transfermarkt lists no loan fee — kept out of the lists above
            </span>
          }
        >
          <ol className="space-y-2">
            {data.loans.map((t) => (
              <TransferRow
                key={t.playerId}
                transfer={t}
                tone="neutral"
                metric={formatMarketValue(t.marketValue)}
                metricLabel="market value"
              />
            ))}
          </ol>
        </SectionPanel>
      )}

      <section className="rounded-lg border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-medium text-text-secondary">How to read this</h2>
        <p className="mt-2 text-sm text-text-muted">
          Every row is one of the season&apos;s 100 biggest moves. Sort by <strong>cash</strong> and
          you get the fee minus what Transfermarkt reckoned the player was worth. Sort by{" "}
          <strong>times value</strong> and you get the same gap as a multiplier — a 2.00× means the
          club paid double. Cash favours the blockbuster deals, times value favours the ones that
          were furthest out of proportion, which is why the two rarely name the same player.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Loans and frees have no fee to speak of, so they get their own sections instead of sitting
          top of every bargain list on a technicality.
        </p>
      </section>

      <DataLastUpdated file="top-transfers-updated-at.txt" />
    </div>
  );
}

function ClubTable({
  rows,
  tone,
}: {
  rows: Awaited<ReturnType<typeof getFeeVsValueData>>["clubs"];
  tone: "over" | "under";
}) {
  if (rows.length === 0) return <p className="text-sm text-text-muted">No clubs qualify.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((c) => (
        <li
          key={c.club.clubId || c.club.name}
          className="flex items-center gap-3 rounded-lg border border-border-subtle bg-card p-2.5"
        >
          {c.club.logoUrl && <ClubLogo src={c.club.logoUrl} />}
          <div className="min-w-0 flex-1">
            {c.club.clubId ? (
              <Link
                href={getTeamDetailHref(c.club.clubId)}
                className="truncate text-sm font-bold text-text-primary hover:underline"
              >
                {c.club.name}
              </Link>
            ) : (
              <span className="truncate text-sm font-bold text-text-primary">{c.club.name}</span>
            )}
            <p className="mt-0.5 font-value text-xs text-text-secondary">
              {formatMarketValue(c.fees)} on {c.signings}{" "}
              {c.signings === 1 ? "signing" : "signings"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "font-value text-sm",
                tone === "over" ? "text-accent-cold" : "text-accent-hot",
              )}
            >
              {formatPremium(c.premium)}
            </p>
            <Badge variant="outline" className="mt-0.5 font-value">
              {formatRatio(c.ratio)}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
