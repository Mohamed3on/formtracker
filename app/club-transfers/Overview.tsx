"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SectionPanel } from "@/components/SectionPanel";
import { TOP_TRANSFER_LIMIT } from "@/lib/constants";
import type { ClubWindow } from "@/lib/fee-vs-value";
import {
  CLUB_MODES,
  TONE_TEXT,
  rankClubs,
  seasonLabel,
  surplus,
  windowSentence,
  type ModeSpec,
  type Tone,
} from "@/lib/fee-vs-value-rankings";
import { formatMarketValue, formatMillions, getTeamDetailHref } from "@/lib/format";
import { crestUrl } from "@/lib/transfermarkt/image";
import { cn } from "@/lib/utils";
import type { TransferBalanceMetric, TransferBalanceWindow } from "@/app/types";

const money = formatMarketValue;
const { buying, selling, "squad-value": squadValue, overall } = CLUB_MODES;

/**
 * The overall verdict with the squad's direction as a condition on top: came
 * out ahead *and* stronger, came out behind *and* weaker. Not a ranking of its
 * own — the order is the overall one — just the two cards that name the
 * double, so a club that came out ahead by selling everyone (PSG) sits beside
 * one that came out ahead by getting better for less (Como).
 */
const STRONGER: ModeSpec = {
  ...overall,
  ends: [
    {
      title: "Came out ahead & stronger",
      tone: "under",
      side: "in",
      qualifies: (c) => surplus(c) > 0 && c.netValue > 0,
    },
    {
      title: "Came out behind & weaker",
      tone: "over",
      side: "out",
      qualifies: (c) => surplus(c) < 0 && c.netValue < 0,
    },
  ],
};

/** The five cards of each business row: the end of each ranking, in the order
 *  the ledger's columns run, then the double. */
const BEST: [ModeSpec, 0 | 1][] = [
  [buying, 1],
  [selling, 0],
  [squadValue, 0],
  [overall, 0],
  [STRONGER, 0],
];
const WORST: [ModeSpec, 0 | 1][] = [
  [buying, 0],
  [selling, 1],
  [squadValue, 1],
  [overall, 1],
  [STRONGER, 1],
];

/** The sentence under a card's figure — what the club actually did. */
function sentence(mode: ModeSpec, c: ClubWindow): string {
  if (mode === buying) return `${money(c.in.marketValue)} of players for ${money(c.in.fees)}`;
  if (mode === selling) return `${money(c.out.marketValue)} of players for ${money(c.out.fees)}`;
  if (mode === squadValue) return `${money(c.in.marketValue)} in · ${money(c.out.marketValue)} out`;
  return windowSentence(c);
}

interface Leader {
  label: string;
  clubId: string;
  name: string;
  logoUrl?: string;
  figure: string;
  tone: Tone;
  sub: string;
  /** The ranking this card heads, for a variant that can open it. The double
   *  opens the overall ranking, which is the order it was read in. */
  opens?: [ModeSpec, 0 | 1];
}

function leaderOf(rows: ClubWindow[], [mode, endIndex]: [ModeSpec, 0 | 1]): Leader | null {
  const c = rankClubs(rows, mode, endIndex)[0];
  if (!c) return null;
  return {
    label: mode.ends[endIndex].title,
    clubId: c.club.clubId,
    name: c.club.name,
    logoUrl: c.club.logoUrl,
    figure: mode.figure(c),
    tone: mode.ends[endIndex].tone,
    sub: sentence(mode, c),
    opens: [mode === STRONGER ? overall : mode, endIndex],
  };
}

const CASH_LABEL: Record<TransferBalanceMetric, string> = {
  expenditure: "Gross spend",
  income: "Sales",
  netSpender: "Biggest net spender",
  netProfit: "Biggest net profit",
};
const CASH_ORDER: TransferBalanceMetric[] = ["expenditure", "income", "netSpender", "netProfit"];

function cashLeaders(cash: TransferBalanceWindow): Leader[] {
  const club = (id: string) => cash.clubs.find((c) => c.id === id);
  return CASH_ORDER.map((metric) => {
    const l = cash.leaders[metric];
    const c = club(l.id);
    const sub =
      metric === "expenditure"
        ? c
          ? `${c.arrivals} signings`
          : ""
        : metric === "income"
          ? c
            ? `${c.departures} departures`
            : ""
          : metric === "netSpender"
            ? "spent minus banked"
            : "banked minus spent";
    return {
      label: CASH_LABEL[metric],
      clubId: l.id,
      name: c?.name ?? l.name,
      figure: formatMillions(l.value),
      tone: metric === "netSpender" ? "over" : metric === "netProfit" ? "under" : "neutral",
      sub,
    };
  });
}

function LeaderCard({
  l,
  onPick,
}: {
  l: Leader;
  onPick?: (mode: ModeSpec, endIndex: 0 | 1) => void;
}) {
  const label = `${l.label}`;
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        {l.opens && onPick ? (
          // The label opens the ranking this club heads.
          <button
            type="button"
            onClick={() => onPick(...l.opens!)}
            className="mb-2 block cursor-pointer text-left text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
          >
            {label}
            {" "}
            <span aria-hidden>↓</span>
          </button>
        ) : (
          <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
        )}
        <div className="mb-1 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={l.logoUrl ?? crestUrl(l.clubId)}
            alt=""
            loading="lazy"
            className="size-5 shrink-0 object-contain"
          />
          <Link
            href={getTeamDetailHref(l.clubId)}
            className="truncate text-sm font-bold hover:underline"
          >
            {l.name}
          </Link>
        </div>
        <p className={cn("font-value text-lg", TONE_TEXT[l.tone])}>{l.figure}</p>
        {l.sub && <p className="mt-0.5 font-value text-xs text-text-muted">{l.sub}</p>}
      </CardContent>
    </Card>
  );
}

/** Who tops two of the four cash measures at once — the balance page's own
 *  hook, kept. */
function MultiWinner({ cash }: { cash: TransferBalanceWindow }) {
  if (cash.winners.length === 0) {
    return (
      <p className="text-xs text-text-muted">
        No club tops two of the four over this window — widen it to find one.
      </p>
    );
  }
  return (
    <Card className="border-accent-gold bg-accent-gold/5">
      <CardContent className="p-3 sm:p-4">
        {cash.winners.map((w) => (
          <p key={w.id} className="text-sm">
            <Link href={getTeamDetailHref(w.id)} className="font-bold hover:underline">
              {w.name}
            </Link>{" "}
            tops <span className="font-value">{w.metrics.length}</span> of{" "}
            <span className="font-value">4</span> —{" "}
            {w.metrics.map((m) => CASH_LABEL[m]).join(" + ")}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

/** The fifth card takes the whole row on a phone rather than sitting alone in
 *  a half-width slot. */
const FIVE_ACROSS =
  "grid grid-cols-2 gap-3 lg:grid-cols-5 [&>:nth-child(5)]:col-span-2 lg:[&>:nth-child(5)]:col-span-1";

/**
 * The top of every category: the best business, the worst, then the money.
 *
 * The business rows read the whole window, loans counted — the same cut the
 * club-page badges quote, so a club badged "Shopped best" is the club on the
 * card. The seasons control lives up here with the money cards it rewrites, so
 * the toggle scopes exactly the two things it changes — these cards and the
 * cash table at the bottom — and nothing about value.
 */
export function Overview({
  rows,
  season,
  cash,
  windows,
  seasons,
  onSeasons,
  onPick,
}: {
  /** Every club window, loans in, unfiltered. */
  rows: ClubWindow[];
  season: number;
  cash: TransferBalanceWindow;
  windows: TransferBalanceWindow[];
  seasons: number;
  onSeasons: (n: number) => void;
  onPick: (mode: ModeSpec, endIndex: 0 | 1) => void;
}) {
  const present = (l: Leader | null): l is Leader => l !== null;
  const best = useMemo(() => BEST.map((e) => leaderOf(rows, e)).filter(present), [rows]);
  const worst = useMemo(() => WORST.map((e) => leaderOf(rows, e)).filter(present), [rows]);
  const money = useMemo(() => cashLeaders(cash), [cash]);

  return (
    <div className="space-y-6">
      <SectionPanel
        title="Best business"
        aside={
          <span className="text-xs text-text-muted">
            the <span className="font-value">{TOP_TRANSFER_LIMIT}</span> biggest deals of{" "}
            <span className="font-value">{seasonLabel(season)}</span>
          </span>
        }
      >
        <div className={FIVE_ACROSS}>
          {best.map((l) => (
            <LeaderCard key={l.label} l={l} onPick={onPick} />
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Worst business">
        <div className={FIVE_ACROSS}>
          {worst.map((l) => (
            <LeaderCard key={l.label} l={l} onPick={onPick} />
          ))}
        </div>
      </SectionPanel>

      <SectionPanel
        title="Biggest money"
        aside={
          <span className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Seasons</span>
            <ToggleGroup
              type="single"
              value={String(seasons)}
              onValueChange={(v) => v && onSeasons(Number(v))}
              variant="outline"
              size="sm"
              className="rounded-lg"
              aria-label="Seasons"
            >
              {windows.map((w, i) => (
                <ToggleGroupItem
                  key={w.seasons}
                  value={String(w.seasons)}
                  className={cn(
                    "px-2.5",
                    i === 0 && "rounded-l-lg",
                    i === windows.length - 1 && "rounded-r-lg",
                  )}
                >
                  <span className="font-value">{w.seasons}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </span>
        }
      >
        <p className="-mt-1 mb-3 text-xs text-text-muted">
          every deal Transfermarkt lists, <span className="font-value">{cash.label}</span>
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {money.map((l) => (
            <LeaderCard key={l.label} l={l} />
          ))}
        </div>
        <div className="mt-3">
          <MultiWinner cash={cash} />
        </div>
      </SectionPanel>
    </div>
  );
}
