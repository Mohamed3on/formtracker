import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyNote } from "@/components/EmptyNote";
import { SectionPanel } from "@/components/SectionPanel";
import { GapTrack } from "@/app/fee-vs-value/FeeValueBar";
import { ClubMoveRow } from "@/app/fee-vs-value/TransferRow";
import { barGeometry, transferKey, type ClubSide, type ClubWindow } from "@/lib/fee-vs-value";
import {
  CLUB_PATH,
  TONE_TEXT,
  clubWindowSummary,
  gainTone,
  premiumTone,
  seasonLabel,
  sideLabel,
  type Side,
} from "@/lib/fee-vs-value-rankings";
import {
  formatMarketValue,
  formatMillions,
  formatPremium,
  formatRatio,
  formatSignedMillions,
} from "@/lib/format";
import { getFeeVsValueData } from "@/lib/top-transfers";
import {
  BALANCE_METRIC,
  getClubTransferBalance,
  type ClubBalanceWindow,
} from "@/lib/transfer-balance";
import { cn } from "@/lib/utils";

const WINDOW_TITLE = "Fee against value";
const THROUGH_LINK = "text-xs text-text-secondary transition-colors hover:text-text-primary";

// ---------------------------------------------------------------------------
// The money: every deal Transfermarkt lists, over one to four seasons.
// ---------------------------------------------------------------------------

/** One window of transfer business — what went out of the account, what came
 *  into it, and where that leaves the club among the world's big spenders. */
function BalanceRow({
  label,
  seasons,
  club,
  places,
  axisMax,
}: ClubBalanceWindow & { axisMax: number }) {
  return (
    <li className="rounded-lg border border-border-subtle bg-card p-2.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* A div, not a p: `Badge` renders a div, which a paragraph cannot hold. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-value text-sm text-text-primary">{label}</span>
            <span className="text-[10px] uppercase tracking-wide text-text-muted">
              {seasons === 1 ? "this season" : `${seasons} seasons`}
            </span>
            {places.map(({ metric, place }) => (
              <Badge
                key={metric}
                variant="outline"
                className={cn(
                  "gap-1 font-normal",
                  // Leading a measure outright gets the gold the transfer-balance
                  // page gives its leaders.
                  place === 1 && "border-accent-gold/40 bg-accent-gold/10 text-accent-gold",
                )}
              >
                <span className="font-value">#{place}</span> {BALANCE_METRIC[metric]}
              </Badge>
            ))}
          </div>
          {/* Each half stays whole: on a phone this wraps at the separator rather
              than leaving "from 9" stranded on a line of its own. */}
          <p className="mt-1 text-xs text-text-secondary">
            <span className="whitespace-nowrap">
              Spent <span className="font-value">{formatMillions(club.expenditure)}</span> on{" "}
              <span className="font-value">{club.arrivals}</span>
            </span>
            <span className="text-text-muted"> · </span>
            <span className="whitespace-nowrap">
              banked <span className="font-value">{formatMillions(club.income)}</span> from{" "}
              <span className="font-value">{club.departures}</span>
            </span>
          </p>
          {/* The same mark the fee-vs-value bars use, reading the same way: a
              tick at what came in, a bar running to what went out, red when the
              club spent past its income and green when it didn't. */}
          <GapTrack
            {...barGeometry({ worth: club.income, fee: club.expenditure }, axisMax)}
            className="mt-2"
          />
        </div>
        <div className="shrink-0 text-right">
          {/* The site's colour key, not the arithmetic sign: banking more than
              you spent is the good direction, exactly as on the transfer-balance
              table itself. */}
          <span className={cn("block font-value text-sm", TONE_TEXT[gainTone(club.balance)])}>
            {formatSignedMillions(club.balance)}
          </span>
          <span className="block text-[10px] uppercase tracking-wide text-text-muted">balance</span>
        </div>
      </div>
    </li>
  );
}

/**
 * What the club spent and banked, over one to four seasons.
 *
 * A plain file read, so it paints with the rest of the page. Silent for a club
 * that reaches none of the four top-25 tables in any window — most clubs — where
 * its absence is the fact and there is nothing to draw.
 */
async function SpendingSection({ clubId }: { clubId: string }) {
  const windows = await getClubTransferBalance(clubId);
  if (windows.length === 0) return null;

  // One euro axis down the four windows, so a four-season span is visibly bigger
  // business than a single one rather than redrawing the ruler each row.
  const axisMax = Math.max(...windows.map((w) => Math.max(w.club.expenditure, w.club.income)));

  return (
    <SectionPanel
      title="Spending and sales"
      aside={
        <Link href={CLUB_PATH} className={THROUGH_LINK}>
          Every club &rarr;
        </Link>
      }
    >
      <ul className="space-y-2">
        {windows.map((w) => (
          <BalanceRow key={w.seasons} {...w} axisMax={axisMax} />
        ))}
      </ul>
      <p className="mt-2.5 text-xs text-text-muted">
        Every deal Transfermarkt lists, over windows ending with the current season. Positions are
        worldwide and reach the top <span className="font-value">25</span> clubs on each measure, so
        a club can be placed for spending and unplaced for sales.
      </p>
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// The judgement: what the season's biggest moves were worth against what they
// cost.
// ---------------------------------------------------------------------------

/** One side of the window — everything bought, or everything sold — as a total
 *  and then as the moves behind it. */
function SidePanel({
  side,
  direction,
  axisMax,
}: {
  side: ClubSide;
  direction: Side;
  /** Shared euro axis across both panels, so buying and selling compare. */
  axisMax: number;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-elevated">
      <div className="flex items-start gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="font-value text-xs text-text-primary">{sideLabel(side, direction)}</p>
          <p className="mt-0.5 font-value text-xs text-text-secondary">
            {formatMarketValue(side.marketValue)} of players for {formatMarketValue(side.fees)}
          </p>
          {side.marketValue > 0 && (
            <GapTrack
              {...barGeometry({ worth: side.marketValue, fee: side.fees }, axisMax)}
              className="mt-2"
            />
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("font-value text-sm", TONE_TEXT[premiumTone(side.premium, direction)])}>
            {formatPremium(side.premium)}
          </p>
          {side.marketValue > 0 && (
            <p className="font-value text-xs text-text-secondary">{formatRatio(side.ratio)}</p>
          )}
        </div>
      </div>
      <ul className="divide-y divide-border-subtle border-t border-border-subtle px-3">
        {side.transfers.map((t) => (
          <ClubMoveRow key={transferKey(t)} t={t} side={direction} />
        ))}
      </ul>
    </div>
  );
}

/** The window itself: what the two sides came to, then the deals behind them.
 *  Split from the fetch above it so the section's three outcomes — no data, no
 *  deals, a window — read as three bodies in one panel rather than three
 *  near-identical panels. */
function ClubWindow({ club, count, season }: { club: ClubWindow; count: number; season: string }) {
  const sides = (["in", "out"] as const).filter((s) => club[s].players > 0);
  // One euro axis across both panels, so buying and selling compare.
  const axisMax = Math.max(club.in.marketValue, club.in.fees, club.out.marketValue, club.out.fees);

  return (
    <>
      <p className="text-xs text-text-secondary">
        Squad value{" "}
        <span className={cn("font-value", TONE_TEXT[gainTone(club.netValue)])}>
          {formatPremium(club.netValue)}
        </span>
        <span className="text-text-muted">
          {" · "}
          <span className="font-value">{formatMarketValue(club.in.marketValue)}</span> of players
          in, <span className="font-value">{formatMarketValue(club.out.marketValue)}</span> out
        </span>
      </p>

      {/* A club that only bought, or only sold, gets the full width rather than
          half of it beside a hole. */}
      <div className={cn("mt-3 grid grid-cols-1 gap-4", sides.length > 1 && "lg:grid-cols-2")}>
        {sides.map((s) => (
          <SidePanel key={s} side={club[s]} direction={s} axisMax={axisMax} />
        ))}
      </div>

      <p className="mt-2.5 text-xs text-text-muted">
        Only the moves that made the <span className="font-value">{count}</span> biggest transfers
        of <span className="font-value">{season}</span>, each fee held against what the player is
        worth. Green is the good outcome from either end — under value on the way in, over it on the
        way out.
      </p>
    </>
  );
}

/**
 * Every move of this club's that made the season's biggest transfers, priced
 * against what the players are worth.
 *
 * Its own fetch behind its own `<Suspense>`, like `ClubWindowBadges`: the tab
 * should not wait on a transfer scrape, and a Transfermarkt outage must not take
 * the club page down over one section of one tab — hence the `catch`, and hence
 * a body that has to read as well with nothing in it as with a window.
 */
async function WindowSection({ clubId, name }: { clubId: string; name: string }) {
  const data = await getFeeVsValueData().catch(() => null);
  const summary = data && clubWindowSummary(data.transfers, clubId);

  return (
    <SectionPanel
      title={WINDOW_TITLE}
      aside={
        data && (
          <Link href={CLUB_PATH} className={THROUGH_LINK}>
            Every club &rarr;
          </Link>
        )
      }
    >
      {!data ? (
        <EmptyNote>Transfer prices are unavailable right now.</EmptyNote>
      ) : !summary ? (
        <EmptyNote>
          No {name} move is among the <span className="font-value">{data.transfers.length}</span>{" "}
          biggest transfers of <span className="font-value">{seasonLabel(data.season)}</span>.
        </EmptyNote>
      ) : (
        <ClubWindow
          club={summary.club}
          count={data.transfers.length}
          season={seasonLabel(data.season)}
        />
      )}
    </SectionPanel>
  );
}

function WindowSkeleton() {
  return (
    <SectionPanel title={WINDOW_TITLE}>
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-64" />
        {/* A middling window's worth of moves. The panels grow with the deals
            behind them, so nothing fixed can be right for every club — this
            leans towards holding the section below still. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </SectionPanel>
  );
}

/**
 * A club's transfer business, from both of the site's angles at once.
 *
 * The two say different things and are deliberately kept apart rather than
 * netted into one figure. **Fee against value** is the judgement, and leads:
 * only the season's biggest transfers, but each one held against what the
 * player is worth, which is the difference between spending a lot and spending
 * well — and the deals themselves, by name. **Spending and sales** is the money
 * under it: every deal Transfermarkt lists, in cash, over one to four seasons.
 *
 * Their headline figures therefore disagree on purpose, and each reads with its
 * own sign convention — a balance is positive when a club banked more than it
 * spent, a premium is positive when it paid over the odds. Both captions spell
 * out the two numbers behind them so the sign never has to carry the meaning.
 *
 * The lead section is the streamed one, so its skeleton holds the top of the tab
 * while the scrape lands rather than letting the section below it jump.
 */
export function TransfersTab({ clubId, name }: { clubId: string; name: string }) {
  return (
    <div className="space-y-8">
      <Suspense fallback={<WindowSkeleton />}>
        <WindowSection clubId={clubId} name={name} />
      </Suspense>
      <SpendingSection clubId={clubId} />
    </div>
  );
}
