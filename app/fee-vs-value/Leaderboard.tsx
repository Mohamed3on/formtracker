"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PricedTransfer } from "@/lib/fee-vs-value";
import { formatPremium, formatRatio, TransferRow } from "./TransferRow";

type Direction = "over" | "under";
type Basis = "premium" | "ratio";

const COPY: Record<Direction, Record<Basis, { title: string; blurb: string }>> = {
  over: {
    premium: {
      title: "Paid the most over the odds",
      blurb: "The fee minus what the player was worth. Big-money deals top this one by nature.",
    },
    ratio: {
      title: "Paid the most times over value",
      blurb:
        "How many times the fee covers the player's value. This is where smaller deals look silly.",
    },
  },
  under: {
    premium: {
      title: "Biggest bargains in cash",
      blurb: "How much value the buyer picked up for nothing, in euros off the asking price.",
    },
    ratio: {
      title: "Biggest bargains, times value",
      blurb: "Cents on the euro. 0.50× means the buyer paid half what the player was worth.",
    },
  },
};

const LIMIT = 15;

export function Leaderboard({
  ranked,
}: {
  ranked: Record<`${Direction}paid${"Absolute" | "Ratio"}`, PricedTransfer[]>;
}) {
  const [direction, setDirection] = useState<Direction>("over");
  const [basis, setBasis] = useState<Basis>("premium");

  const list =
    direction === "over"
      ? basis === "premium"
        ? ranked.overpaidAbsolute
        : ranked.overpaidRatio
      : basis === "premium"
        ? ranked.underpaidAbsolute
        : ranked.underpaidRatio;

  const { title, blurb } = COPY[direction][basis];

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
          <TabsList>
            <TabsTrigger value="over">Overpaid</TabsTrigger>
            <TabsTrigger value="under">Bargains</TabsTrigger>
          </TabsList>
        </Tabs>

        <ToggleGroup
          type="single"
          value={basis}
          onValueChange={(v) => v && setBasis(v as Basis)}
          variant="outline"
          size="sm"
          className="rounded-lg"
          aria-label="Sort by"
        >
          <ToggleGroupItem value="premium" className="rounded-l-lg">
            Cash
          </ToggleGroupItem>
          <ToggleGroupItem value="ratio" className="rounded-r-lg">
            Times value
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mt-4">
        <h2 className="text-base font-pixel font-bold text-text-primary sm:text-lg">{title}</h2>
        <p className="mt-1 text-sm text-text-muted">{blurb}</p>
      </div>

      <ol className="mt-3 space-y-2">
        {list.slice(0, LIMIT).map((t, i) => (
          <TransferRow
            key={t.playerId}
            transfer={t}
            rank={i + 1}
            tone={direction}
            metric={basis === "premium" ? formatPremium(t.premium) : formatRatio(t.ratio)}
            secondary={basis === "premium" ? formatRatio(t.ratio) : formatPremium(t.premium)}
            showPrice
          />
        ))}
      </ol>
    </section>
  );
}
