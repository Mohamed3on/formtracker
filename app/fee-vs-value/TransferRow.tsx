import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PositionDisplay } from "@/components/PositionDisplay";
import { NationalityFlag } from "@/components/NationalityFlag";
import { ClubLogo } from "@/components/ClubLogo";
import { RankBadge } from "@/components/RankBadge";
import { formatMarketValue, getPlayerDetailHref, getTeamDetailHref } from "@/lib/format";
import { isSameLeague } from "@/lib/leagues";
import { cn } from "@/lib/utils";
import type { TopTransfer, TransferClub } from "@/app/types";
import { revalued, type PricedTransfer } from "@/lib/fee-vs-value";
import type { Tone } from "@/lib/fee-vs-value-rankings";
import { FeeValueBar, WasWorthMark } from "./FeeValueBar";

/** One end of a move. Links through to the squad when TM gave us a club id. */
function ClubSide({ club, dim }: { club: TransferClub; dim?: boolean }) {
  const body = (
    <>
      {club.logoUrl && <ClubLogo src={club.logoUrl} />}
      <span className="truncate">{club.name}</span>
    </>
  );
  const className = cn("inline-flex min-w-0 items-center gap-1", dim && "text-text-muted");

  return club.clubId ? (
    <Link href={getTeamDetailHref(club.clubId)} className={cn(className, "hover:underline")}>
      {body}
    </Link>
  ) : (
    <span className={className}>{body}</span>
  );
}

/** The two clubs of a move, and the leagues behind them when the player is
 *  actually changing division.
 *
 *  Both leagues are scraped on every row and neither was ever shown. Printing
 *  them unconditionally would be noise — most of the Premier League's business
 *  is with itself, and "Premier League → Premier League" tells nobody anything.
 *  Printed only where they differ, which is three quarters of this window, it is
 *  the one thing the club names alone don't say: which way the player is moving
 *  through European football. */
function ClubPair({ transfer }: { transfer: TopTransfer }) {
  const { from, to } = transfer;
  const moved = from.league && to.league && !isSameLeague(from.league, to.league);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-secondary">
      <ClubSide club={from} dim />
      <span aria-hidden className="text-text-muted">
        →
      </span>
      <ClubSide club={to} />
      {moved && (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-muted">
          <span aria-hidden className="opacity-40">
            •
          </span>
          {from.league} <span aria-hidden>→</span> {to.league}
        </span>
      )}
    </div>
  );
}

interface TransferRowProps {
  transfer: PricedTransfer;
  rank?: number;
  /** Headline figure on the right — the premium, the ratio, or the fee itself. */
  metric: string;
  /** Second, smaller figure under the headline (e.g. the ratio beside a premium). */
  secondary?: string;
  /** Shared euro axis for the fee-vs-value bar. Omit to hide the bar. */
  axisMax?: number;
  tone: Tone;
}

export const TONE_TEXT: Record<Tone, string> = {
  over: "text-accent-cold",
  under: "text-accent-hot",
  neutral: "text-text-primary",
};

const TONE_RANK: Record<Tone, string> = {
  over: "bg-accent-cold text-background",
  under: "bg-accent-hot text-background",
  neutral: "bg-elevated text-text-muted",
};

export function TransferRow({
  transfer,
  rank,
  metric,
  secondary,
  axisMax,
  tone,
}: TransferRowProps) {
  // A deal priced at exactly what the player is worth is neither an overpay nor
  // a bargain, whichever list it turned up in — and since the premium moved onto
  // today's value, "exactly" is a thing that happens: it is what a club looks
  // like once the market has come round to the price it paid.
  const shown: Tone = transfer.premium === 0 ? "neutral" : tone;

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-card transition-colors hover:bg-card-hover">
      <div className="flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        {rank !== undefined && <RankBadge rank={rank} highlightClass={TONE_RANK[shown]} />}
        <PlayerAvatar imageUrl={transfer.imageUrl} name={transfer.name} size="sm" />

        <div className="min-w-0 flex-1">
          {/* `block` matters: `truncate` sets overflow:hidden, which an inline
              box ignores, so a long name used to run into the figures. */}
          <Link
            href={getPlayerDetailHref(transfer.playerId)}
            className="block truncate text-sm font-bold text-text-primary hover:underline"
          >
            {transfer.name}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
            <PositionDisplay position={transfer.position} abbreviated />
            <span className="opacity-40">•</span>
            <NationalityFlag url={transfer.nationalityFlagUrl} name={transfer.nationality} />
            <span className="opacity-40">•</span>
            <span className="font-value">{transfer.age}y</span>
          </div>
          <ClubPair transfer={transfer} />
        </div>

        <div className="shrink-0 text-right">
          <p className={cn("font-value text-sm sm:text-base", TONE_TEXT[shown])}>{metric}</p>
          {secondary && <p className="font-value text-xs text-text-secondary">{secondary}</p>}
          {/* What he was valued at on the day he moved, where the market has
              since moved him. Same white dot as the one on the bar below, so the
              figure and the mark read as one fact rather than two. */}
          {revalued(transfer) && (
            <p className="flex items-center justify-end gap-1 text-[10px] text-text-primary">
              <WasWorthMark />
              <span className="sr-only">Was worth </span>
              <span className="font-value">{formatMarketValue(transfer.marketValue)}</span>
              <span className="text-text-muted max-sm:sr-only">at the move</span>
            </p>
          )}
        </div>
      </div>

      {axisMax !== undefined && (
        <div className="border-t border-border-subtle bg-elevated px-2.5 py-2 sm:px-3">
          <FeeValueBar transfer={transfer} axisMax={axisMax} />
        </div>
      )}
    </div>
  );
}

/** `€90.0M → €138.0M`, the raw pair behind every premium on the page. Still the
 *  right form inside an expanded club, where a row is one line of a table
 *  rather than a card with room for a bar. */
export function ValueToFee({ transfer }: { transfer: PricedTransfer }) {
  return (
    <span className="font-value text-xs text-text-secondary">
      {/* `worth`, not the frozen `marketValue`: this pair is the sum the premium
          beside it states, so showing the value the premium was *not* measured
          against printed "€40.0M → €50.0M" next to "€0" on every re-rated row. */}
      {formatMarketValue(transfer.worth)}
      <span className="mx-1 text-text-muted">→</span>
      {transfer.fee > 0 ? formatMarketValue(transfer.fee) : transfer.feeText}
    </span>
  );
}
