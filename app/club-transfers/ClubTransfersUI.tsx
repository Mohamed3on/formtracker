"use client";

import { useMemo, useRef, useState } from "react";
import { Combobox } from "@/components/Combobox";
import { SectionPanel } from "@/components/SectionPanel";
import { TOP_TRANSFER_LIMIT } from "@/lib/constants";
import { buildClubWindows, type PricedTransfer } from "@/lib/fee-vs-value";
import {
  CLUB_MODES,
  CLUB_PATH,
  endKeyOf,
  inLeague,
  leagueGroups,
  resolveClubs,
  seasonLabel,
  type ModeSpec,
} from "@/lib/fee-vs-value-rankings";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { cn } from "@/lib/utils";
import type { TransferBalanceResult } from "@/app/types";
import { BalanceTable } from "./BalanceTable";
import { ClubLedger, ledgerBlurb, ledgerTitle, type LedgerSort } from "./ClubLedger";
import { Overview } from "./Overview";

const MODES = Object.values(CLUB_MODES) as ModeSpec[];

/**
 * The club page: the top of every category, then every club as a row.
 *
 * Which ranking leads the ledger, which end of it and the league all live in
 * the URL, so a view can be linked and a club's badge lands on the exact table
 * it heads. The cash window's span is local state — it scopes only the money
 * cards and the cash table, and nothing links into it.
 */
export function ClubTransfersUI({
  transfers,
  balance,
  season,
}: {
  transfers: PricedTransfer[];
  balance: TransferBalanceResult;
  season: number;
}) {
  const { params, replace } = useQueryParams(CLUB_PATH);
  const by = params.get("by");
  const { mode, endKey, endIndex } = resolveClubs(by, params.get("end"));
  const sort: LedgerSort = by === "net" ? { net: endKey } : { mode, endIndex };
  const league = params.get("league") || "all";

  const [seasons, setSeasons] = useState(balance.windows[0].seasons);
  const cash = balance.windows.find((w) => w.seasons === seasons) ?? balance.windows[0];

  // One set of windows for both, narrowed to the chosen league by club rather
  // than by move: narrowing the moves first would restate each club's window as
  // "the part of it that touched this league" and print it under the same
  // heading.
  const all = useMemo(() => buildClubWindows(transfers), [transfers]);
  const rows = useMemo(() => all.filter((c) => inLeague(c.club.league, league)), [all, league]);
  const leagues = useMemo(() => leagueGroups(transfers), [transfers]);

  const show = (m: ModeSpec, i: 0 | 1) => replace({ by: m.slug, end: endKeyOf(m, i) });

  // A card's label opens its ranking, which is further down the page than the
  // click — go there too, or the click reads as having done nothing.
  const ledgerRef = useRef<HTMLElement>(null);
  const openLedger = (m: ModeSpec, i: 0 | 1) => {
    show(m, i);
    ledgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      <Overview
        rows={all}
        season={season}
        cash={cash}
        windows={balance.windows}
        seasons={seasons}
        onSeasons={setSeasons}
        onPick={openLedger}
      />

      <section ref={ledgerRef} className="scroll-mt-28 space-y-4">
        {/* No "rank by" control beside this: the table's own column headers are
            the eight questions, each one clicked once for its best end and
            again for its worst, and the heading below says which is showing.
            The phone view has no headers to click, so it keeps a picker of its
            own inside the card list. */}
        <div className="min-w-0">
          <h2 className="text-base font-pixel font-bold text-text-primary sm:text-lg">
            {ledgerTitle(sort)}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{ledgerBlurb(sort)}</p>
        </div>

        {/* Whose business to show. It lives in the URL like every other choice
            here, so a filtered view can be linked. */}
        <div className="flex flex-wrap items-center gap-2">
          <Combobox
            value={league}
            onChange={(v) => replace({ league: v === "all" ? null : v || null })}
            groups={leagues}
            placeholder="All leagues"
            searchPlaceholder="Search leagues..."
          />
        </div>

        <ClubLedger
          rows={rows}
          sort={sort}
          onSort={(key, end) => {
            if (key === "net") replace({ by: "net", end });
            else {
              const m = MODES.find((x) => x.slug === key)!;
              replace({ by: m.slug, end });
            }
          }}
        />

        <p className={cn("text-xs text-text-muted")}>
          Only the <span className="font-value">{TOP_TRANSFER_LIMIT}</span> biggest transfers of{" "}
          <span className="font-value">{seasonLabel(season)}</span>, each fee held against what the
          player is worth today. <strong>Bought</strong> and <strong>Sold</strong> are fee minus
          worth — green is the good outcome from either end, under value on the way in and over it
          on the way out. <strong>Overall</strong> is value added minus money spent, everything
          netted — a club can come out ahead while getting weaker if the market paid it enough on
          the way. Loans count towards <strong>Squad value</strong>, where a player on loan is in
          the dressing room either way, and a loan fee counts as cash in <strong>Net</strong>. What
          they stay out of is <strong>Bought</strong> and <strong>Sold</strong>: TM publishes a fee
          for few loans, and neither a €3m loan fee nor no fee at all is what a €25m player was
          worth. A club keeps its whole window under any league filter; open a row for the deals
          behind it.
        </p>
      </section>

      <SectionPanel
        title="The money, one to four seasons"
        aside={<span className="text-xs text-text-muted">every deal Transfermarkt lists</span>}
      >
        <BalanceTable window={cash} />
        <p className="mt-3 text-xs text-text-muted">
          The world&apos;s biggest buyers and sellers, in cash, over windows ending with the current
          season. Positions reach the top <span className="font-value">25</span> clubs on each
          measure.
        </p>
      </SectionPanel>
    </div>
  );
}
