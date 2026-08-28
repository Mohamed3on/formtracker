"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const LIMIT = 15;

const figure = (basis: Basis, t: Ranked["byFee"][number]) => {
  if (basis === "premium") return formatPremium(t.premium);
  if (basis === "ratio") return formatRatio(t.ratio);
  return formatMarketValue(basis === "fee" ? t.fee : t.marketValue);
};

export function Leaderboard({ ranked }: { ranked: Ranked }) {
  const [view, setView] = useState<View>("over");
  // One index rather than one basis: switching tabs would otherwise leave a
  // measure selected that the new tab has no list for.
  const [option, setOption] = useState(0);

  const { tone, options } = VIEWS[view];
  const current = options[option] ?? options[0];
  // Ranked before slicing, so a deal tied with the 15th still shares its number.
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
          value={String(option)}
          onValueChange={(v) => v && setOption(Number(v))}
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

      <ol className="mt-3 space-y-2">
        {list.slice(0, LIMIT).map(({ transfer: t, rank: r }) => (
          <TransferRow
            key={t.playerId}
            transfer={t}
            rank={r}
            tone={tone}
            metric={figure(current.basis, t)}
            secondary={secondary && figure(secondary.basis, t)}
            showPrice
          />
        ))}
      </ol>
    </section>
  );
}
