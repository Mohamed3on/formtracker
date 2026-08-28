import { leaders, rank } from "@/lib/fee-vs-value";
import { getFeeVsValueData } from "@/lib/top-transfers";
import { formatMarketValue } from "@/lib/format";
import { createPageMetadata } from "@/lib/metadata";
import { SectionPanel } from "@/components/SectionPanel";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ClubTables } from "./ClubTables";
import { HeadlineCard } from "./HeadlineCard";
import { Leaderboard } from "./Leaderboard";
import { formatPremium, formatRatio, TransferRow } from "./TransferRow";

export const metadata = createPageMetadata({
  title: "Fee vs Value",
  description:
    "Which clubs paid over the odds and which got a bargain in the season's 200 biggest transfers. Every fee held up against the player's Transfermarkt market value, in cash and times value.",
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
      hint: "How much more than his value the club paid.",
    },
    times: {
      label: "Biggest overpay — times value",
      hint: "How many times his value the club paid. 2.00× means they paid double.",
    },
    both: {
      label: "Biggest overpay — cash and times value",
      hint: "The same deal tops both lists.",
    },
  },
  {
    side: "under" as const,
    cash: {
      label: "Biggest bargain — cash",
      hint: "How much less than his value the club paid.",
    },
    times: {
      label: "Biggest bargain — times value",
      hint: "What share of his value the club paid. 0.50× means half price.",
    },
    both: {
      label: "Biggest bargain — cash and times value",
      hint: "The same deal tops both lists.",
    },
  },
];

/** The deals topping a side on each measure — lists, because ties are joint.
 *  Cash and times value normally crown different players; when a single deal
 *  takes both outright it gets one card carrying both figures, since two
 *  identical cards read as a rendering bug rather than as the finding it is. */
function headlineWinners(ranked: ReturnType<typeof rank>, side: "over" | "under") {
  const cash = leaders(
    side === "over" ? ranked.overpaidAbsolute : ranked.underpaidAbsolute,
    (t) => t.premium,
  );
  const times = leaders(
    side === "over" ? ranked.overpaidRatio : ranked.underpaidRatio,
    (t) => t.ratio,
  );
  const sweep = cash.length === 1 && times.length === 1 && cash[0].playerId === times[0].playerId;
  return { cash, times, sweep };
}

export default async function FeeVsValuePage() {
  const data = await getFeeVsValueData();
  const ranked = rank(data.paid, data.free);
  const { totals } = data;

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
              transfers={winners.cash}
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
                transfers={winners.cash}
                metrics={["premium"]}
                tone={side}
              />,
              <HeadlineCard
                key={`${side}-times`}
                label={times.label}
                hint={times.hint}
                transfers={winners.times}
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
            sub={`on ${data.paid.length + data.free.length} permanent signings`}
          />
          <SummaryStat
            label="What they're worth"
            value={formatMarketValue(totals.marketValue)}
            sub="what those players were worth"
          />
          <SummaryStat
            label="Paid over the odds"
            value={formatPremium(totals.premium)}
            sub="more than they were worth"
            accentClass={totals.premium > 0 ? "text-accent-cold" : "text-accent-hot"}
          />
          <SummaryStat
            label="Times their value"
            value={formatRatio(totals.ratio)}
            sub="what clubs paid, all in"
            accentClass={totals.ratio > 1 ? "text-accent-cold" : "text-accent-hot"}
          />
        </CardContent>
      </Card>

      <Leaderboard ranked={ranked} />

      <ClubTables clubs={data.clubs} />

      {data.loans.length > 0 && (
        <SectionPanel
          title="Loans"
          aside={
            <span className="text-xs text-text-muted">
              a loan is not a signing — kept out of the lists, counted for their club
            </span>
          }
        >
          <ol className="space-y-2">
            {data.loans.map((t) => (
              <TransferRow
                key={t.playerId}
                transfer={t}
                tone="neutral"
                showPrice
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
          Every row is one of the {data.paid.length + data.free.length + data.loans.length} biggest
          transfers this season. Sort by <strong>cash</strong> to see how much more, or less, than
          his value a club paid. Sort by <strong>times value</strong> to see it as a multiplier:
          2.00× means they paid double, 0.50× means half price. Big transfers lead the cash list and
          small ones lead the times value list, so the two rarely name the same player.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          A free transfer is still a signing, so it counts in the cash lists — picking up a €45M
          defender for nothing is the best bargain there is. It is left out of the times value
          lists, where every free comes to 0.00× and they would fill the top in a dead heat. A loan
          is not a signing at all, so it stays out of both and gets its own section below.
        </p>
      </section>
    </div>
  );
}
