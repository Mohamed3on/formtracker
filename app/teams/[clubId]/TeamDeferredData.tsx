"use client";

import { Crown, Trophy, TriangleAlert } from "lucide-react";
import { useManagerQuery } from "@/lib/hooks/use-manager-query";
import { ManagerSkeleton } from "@/app/components/ManagerPPGBadge";
import { InfoTip } from "@/app/components/InfoTip";

export function ManagerClient({ clubId }: { clubId: string }) {
  const { data: manager, isLoading } = useManagerQuery(clubId);

  if (isLoading)
    return (
      <div className="mt-3">
        <ManagerSkeleton />
      </div>
    );
  if (!manager) return null;

  const hasRanking =
    manager.ppg !== null &&
    manager.ppgRank !== undefined &&
    manager.totalComparableManagers !== undefined;
  const isOnly = hasRanking && manager.totalComparableManagers === 1;
  const isBest = hasRanking && manager.ppgRank === 1 && !isOnly;
  const isWorst =
    hasRanking && manager.ppgRank === manager.totalComparableManagers && !isBest && !isOnly;

  // A single standout distinction, surfaced as a badge in the hero's pill language.
  const distinction = isOnly
    ? {
        Icon: Crown,
        label: "Longest-serving since '95",
        pill: "border-accent-gold/30 bg-accent-gold/10 text-accent-gold shadow-[0_0_18px_rgba(255,215,0,0.16)]",
      }
    : isBest
      ? {
          Icon: Trophy,
          label: "Best PPG since '95",
          pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        }
      : isWorst
        ? {
            Icon: TriangleAlert,
            label: "Worst PPG since '95",
            pill: "border-red-500/30 bg-red-500/10 text-red-400",
          }
        : null;
  const DistinctionIcon = distinction?.Icon;

  // "#1 of 1" is noise — only rank against an actual field of peers.
  const showRank = hasRanking && !isOnly;

  return (
    <div className="mt-3 space-y-1.5 text-sm text-text-secondary animate-fade-in">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-text-muted">Manager:</span>
        <a
          href={manager.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-semibold hover:underline transition-colors ${manager.isCurrentManager ? "text-accent-blue" : "text-text-muted"}`}
        >
          {manager.name}
        </a>
        {!manager.isCurrentManager && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-500 border border-red-500/30">
            Sacked
          </span>
        )}
        {distinction && DistinctionIcon && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${distinction.pill}`}
          >
            <DistinctionIcon className="h-3.5 w-3.5" />
            {distinction.label}
          </span>
        )}
      </div>

      {manager.matches === 0 ? (
        <p className="text-xs text-text-muted">New manager · no games yet</p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-secondary">
          {manager.ppg !== null && (
            <span>
              <span className="font-value">{manager.ppg.toFixed(2)}</span> PPG
            </span>
          )}
          {manager.ppg !== null && <span className="text-text-muted">·</span>}
          <span>
            <span className="font-value">{manager.matches}</span>{" "}
            {manager.matches === 1 ? "game" : "games"}
          </span>
          {showRank && (
            <>
              <span className="text-text-muted">·</span>
              <span className="inline-flex items-center gap-1">
                <span>
                  <span className="font-value">#{manager.ppgRank}</span> of{" "}
                  <span className="font-value">{manager.totalComparableManagers}</span> by PPG
                </span>
                <InfoTip>
                  Among managers with {manager.matches}+ games at this club since 1995.
                </InfoTip>
              </span>
            </>
          )}
        </p>
      )}

      {isOnly && (
        <p className="text-[11px] text-text-muted">
          No other manager since 1995 has reached {manager.matches} games at this club.
        </p>
      )}

      {manager.bestManager && manager.worstManager && !isOnly && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            <span className="text-text-muted">Best:</span>{" "}
            <a
              href={manager.bestManager.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline font-medium"
            >
              {manager.bestManager.name}
            </a>
            <span className="font-value text-text-secondary ml-1">
              {manager.bestManager.ppg.toFixed(2)} PPG
            </span>
            <span className="text-text-muted ml-1">({manager.bestManager.years})</span>
          </span>
          <span>
            <span className="text-text-muted">Worst:</span>{" "}
            <a
              href={manager.worstManager.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 hover:underline font-medium"
            >
              {manager.worstManager.name}
            </a>
            <span className="font-value text-text-secondary ml-1">
              {manager.worstManager.ppg.toFixed(2)} PPG
            </span>
            <span className="text-text-muted ml-1">({manager.worstManager.years})</span>
          </span>
        </div>
      )}
    </div>
  );
}
