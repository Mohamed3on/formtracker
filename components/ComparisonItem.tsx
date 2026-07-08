import Link from "next/link";
import type { PlayerStats } from "@/app/types";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ClubLogo } from "@/components/ClubLogo";
import { getPlayerDetailHref } from "@/lib/format";

export function ComparisonItem({
  player,
  positive,
  count,
}: {
  player: PlayerStats;
  positive: boolean;
  count?: number;
}) {
  return (
    <Link
      href={getPlayerDetailHref(player.playerId)}
      className="group flex items-center gap-3 rounded-2xl border border-border-subtle bg-elevated p-3 transition-transform duration-200 hover:-translate-y-px hover:border-border-medium hover:bg-card-hover motion-reduce:transform-none"
    >
      <PlayerAvatar
        imageUrl={player.imageUrl}
        name={player.name}
        size="sm"
        className="border border-border-subtle"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{player.name}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
          {player.clubLogoUrl && <ClubLogo src={player.clubLogoUrl} />}
          <span className="truncate">{player.club}</span>
          {player.age > 0 && (
            <>
              <span className="shrink-0 opacity-40">·</span>
              <span className="shrink-0">{player.age}y</span>
            </>
          )}
          <span className="shrink-0 opacity-40">·</span>
          <span className="shrink-0">{player.marketValueDisplay}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-value ${positive ? "text-accent-cold-soft" : "text-accent-hot"}`}
        >
          {player.points} <span className="text-[10px] text-text-muted">npG+A</span>
        </p>
        <p className="text-[11px] text-text-muted">
          {player.minutes?.toLocaleString() || "0"}&apos;
        </p>
        {count != null && count > 0 && (
          <p
            className={`text-[10px] ${positive ? "text-accent-cold-soft/60" : "text-accent-hot/60"}`}
          >
            {positive ? `outscores ${count} peers` : `outscored by ${count} peers`}
          </p>
        )}
      </div>
    </Link>
  );
}
