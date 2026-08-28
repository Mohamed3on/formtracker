import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PositionDisplay } from "@/components/PositionDisplay";
import { NationalityFlag } from "@/components/NationalityFlag";
import { ClubLogo } from "@/components/ClubLogo";
import { RankBadge } from "@/components/RankBadge";
import { formatMarketValue, getPlayerDetailHref, getTeamDetailHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TopTransfer } from "@/app/types";

export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}×`;
}

export function formatPremium(premium: number): string {
  return `${premium > 0 ? "+" : ""}${formatMarketValue(premium)}`;
}

/** The two clubs of a move, as a `Left → Joined` pair, followed by the
 *  value → fee pair. Wraps on narrow screens rather than truncating — which club
 *  sold is half the story of a bargain, and a premium means nothing without the
 *  value it is a premium over. */
function ClubPair({ transfer, showPrice }: { transfer: TopTransfer; showPrice?: boolean }) {
  const side = (club: TopTransfer["to"], dim?: boolean) => {
    const body = (
      <>
        {club.logoUrl && <ClubLogo src={club.logoUrl} />}
        <span className="truncate">{club.name}</span>
      </>
    );
    return club.clubId ? (
      <Link
        href={getTeamDetailHref(club.clubId)}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 hover:underline",
          dim && "text-text-muted",
        )}
      >
        {body}
      </Link>
    ) : (
      <span className={cn("inline-flex min-w-0 items-center gap-1", dim && "text-text-muted")}>
        {body}
      </span>
    );
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-secondary">
      {side(transfer.from, true)}
      <span aria-hidden className="text-text-muted">
        →
      </span>
      {side(transfer.to)}
      {showPrice && (
        // Separator travels with the price, or it strands at the end of the club
        // line every time the row wraps on a narrow screen.
        <span className="inline-flex items-center gap-1.5">
          <span className="opacity-40">•</span>
          <ValueToFee transfer={transfer} />
        </span>
      )}
    </div>
  );
}

interface TransferRowProps {
  transfer: TopTransfer;
  rank?: number;
  /** Headline figure on the right — the premium, the ratio, or the fee itself. */
  metric: string;
  /** Caption under the figure. Omit inside a ranked list, where the section
   *  heading already names the measure and 15 repeats of it are just noise. */
  metricLabel?: string;
  /** Show the player's value → fee alongside the clubs. */
  showPrice?: boolean;
  /** Second, smaller figure under the headline (e.g. the ratio beside a premium). */
  secondary?: string;
  tone: "over" | "under" | "neutral";
}

const TONE_TEXT = {
  over: "text-accent-cold",
  under: "text-accent-hot",
  neutral: "text-text-primary",
} as const;

const TONE_RANK = {
  over: "bg-accent-cold text-background",
  under: "bg-accent-hot text-background",
  neutral: "bg-elevated text-text-muted",
} as const;

export function TransferRow({
  transfer,
  rank,
  metric,
  metricLabel,
  secondary,
  showPrice,
  tone,
}: TransferRowProps) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-card p-2.5 transition-colors hover:bg-card-hover sm:gap-3 sm:p-3">
      {rank !== undefined && <RankBadge rank={rank} highlightClass={TONE_RANK[tone]} />}
      <PlayerAvatar imageUrl={transfer.imageUrl} name={transfer.name} size="sm" />

      <div className="min-w-0 flex-1">
        <Link
          href={getPlayerDetailHref(transfer.playerId)}
          className="truncate text-sm font-bold text-text-primary hover:underline"
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
        <ClubPair transfer={transfer} showPrice={showPrice} />
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("font-value text-sm sm:text-base", TONE_TEXT[tone])}>{metric}</p>
        {secondary && <p className="font-value text-xs text-text-secondary">{secondary}</p>}
        {metricLabel && (
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">
            {metricLabel}
          </p>
        )}
      </div>
    </li>
  );
}

/** `€90.0M → €138.0M`, the raw pair behind every premium on the page. */
export function ValueToFee({ transfer }: { transfer: TopTransfer }) {
  return (
    <span className="font-value text-xs text-text-secondary">
      {formatMarketValue(transfer.marketValue)}
      <span className="mx-1 text-text-muted">→</span>
      {transfer.fee > 0 ? formatMarketValue(transfer.fee) : transfer.feeText}
    </span>
  );
}
