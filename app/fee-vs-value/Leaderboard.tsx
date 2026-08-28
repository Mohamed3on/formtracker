"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VirtualList } from "@/components/VirtualList";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { withRanks, type rank as rankTransfers } from "@/lib/fee-vs-value";
import { formatMarketValue } from "@/lib/format";
import { formatPremium, formatRatio, TransferRow } from "./TransferRow";

type Ranked = ReturnType<typeof rankTransfers>;
type View = "over" | "under" | "big";
type Basis = "premium" | "ratio" | "fee" | "value";

/** Each view keeps its own pair of measures, so the toggle beside the tabs
 *  always offers the two that make sense for what's on screen. */
const VIEWS: Record<
  View,
  {
    tab: string;
    tone: "over" | "under" | "neutral";
    options: Array<{
      basis: Basis;
      toggle: string;
      title: string;
      blurb: string;
      list: (r: Ranked) => Ranked[keyof Ranked];
      measure: (t: Ranked["byFee"][number]) => number;
    }>;
  }
> = {
  over: {
    tab: "Overpaid",
    tone: "over",
    options: [
      {
        basis: "premium",
        toggle: "Cash",
        title: "Paid the most over the odds",
        blurb: "How much more than his value the club paid. Big transfers lead this list.",
        list: (r) => r.overpaidAbsolute,
        measure: (t) => t.premium,
      },
      {
        basis: "ratio",
        toggle: "Times value",
        title: "Paid the most times his value",
        blurb: "How many times his value the club paid. Small transfers lead this list.",
        list: (r) => r.overpaidRatio,
        measure: (t) => t.ratio,
      },
    ],
  },
  under: {
    tab: "Bargains",
    tone: "under",
    options: [
      {
        basis: "premium",
        toggle: "Cash",
        title: "Biggest bargains in cash",
        blurb: "How much less than his value the club paid.",
        list: (r) => r.underpaidAbsolute,
        measure: (t) => t.premium,
      },
      {
        basis: "ratio",
        toggle: "Times value",
        title: "Biggest bargains, times value",
        blurb: "What share of his value the club paid. 0.50× means half price.",
        list: (r) => r.underpaidRatio,
        measure: (t) => t.ratio,
      },
    ],
  },
  big: {
    tab: "Biggest",
    tone: "neutral",
    options: [
      {
        basis: "fee",
        toggle: "Fee",
        title: "Most expensive signings",
        blurb: "The biggest fees of the season, whatever the player was worth.",
        list: (r) => r.byFee,
        measure: (t) => t.fee,
      },
      {
        basis: "value",
        toggle: "Value",
        title: "Most valuable signings",
        blurb: "The best players to move, by market value, whatever their club paid.",
        list: (r) => r.byValue,
        measure: (t) => t.marketValue,
      },
    ],
  },
};

const figure = (basis: Basis, t: Ranked["byFee"][number]) => {
  if (basis === "premium") return formatPremium(t.premium);
  if (basis === "ratio") return formatRatio(t.ratio);
  return formatMarketValue(basis === "fee" ? t.fee : t.marketValue);
};

/** Roughly a row at desktop width; the virtualizer measures each one for real
 *  once mounted, so a wrapped three-line row on mobile corrects itself. */
const ROW_ESTIMATE = 76;
const ROW_GAP = 8;

export function Leaderboard({ ranked }: { ranked: Ranked }) {
  // Opens on the most valuable signings — the list that reads as the headline
  // "who actually moved this window" before you go looking for mispricing.
  const [view, setView] = useState<View>("big");
  // An index per view, not one shared: switching tabs would otherwise carry a
  // measure across to a tab that has no list for it, and each tab remembers
  // what you last looked at.
  const [option, setOption] = useState<Record<View, number>>({ over: 0, under: 0, big: 1 });

  const { tone, options } = VIEWS[view];
  const current = options[option[view]] ?? options[0];
  // Competition ranking, so tied deals share a number rather than one of them
  // arbitrarily sitting above the other.
  const list = withRanks(current.list(ranked), current.measure);
  const secondary = options.find((o) => o.basis !== current.basis);

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            {(Object.keys(VIEWS) as View[]).map((v) => (
              <TabsTrigger key={v} value={v}>
                {VIEWS[v].tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ToggleGroup
          type="single"
          value={String(option[view])}
          onValueChange={(v) => v && setOption((o) => ({ ...o, [view]: Number(v) }))}
          variant="outline"
          size="sm"
          className="rounded-lg"
          aria-label="Sort by"
        >
          {options.map((o, i) => (
            <ToggleGroupItem
              key={o.basis}
              value={String(i)}
              className={i === 0 ? "rounded-l-lg" : "rounded-r-lg"}
            >
              {o.toggle}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-4">
        <h2 className="text-base font-pixel font-bold text-text-primary sm:text-lg">
          {current.title}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{current.blurb}</p>
      </div>

      {/* Every row, not a top-N: the interesting deals are as often 40th as
          4th. Window-virtualized so 200 rows cost what a screenful costs. */}
      <div role="list" className="mt-3">
        <VirtualList
          items={list}
          estimateSize={ROW_ESTIMATE}
          gap={ROW_GAP}
          keyExtractor={({ transfer: t }) => t.playerId}
          renderItem={({ transfer: t, rank: r }) => (
            <TransferRow
              transfer={t}
              rank={r}
              tone={tone}
              metric={figure(current.basis, t)}
              secondary={secondary && figure(secondary.basis, t)}
              showPrice
            />
          )}
        />
      </div>
    </section>
  );
}
