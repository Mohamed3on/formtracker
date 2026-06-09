"use client";

import type { ManagerInfo } from "@/app/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsTouchDevice } from "@/lib/hooks/use-touch-device";

interface ManagerPPGBadgeProps {
  manager: ManagerInfo;
}

export function ManagerSackedBadge({ manager }: ManagerPPGBadgeProps) {
  if (manager.isCurrentManager) return null;
  return (
    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-red-500/15 text-red-500 border border-red-500/30">
      Sacked
    </span>
  );
}

export function ManagerSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-muted">Manager:</span>
      <Skeleton className="h-4 w-24 rounded" />
      <Skeleton className="h-4 w-16 rounded" />
      <Skeleton className="h-5 w-20 rounded" />
    </div>
  );
}

export function ManagerSection({ manager }: ManagerPPGBadgeProps) {
  return (
    <div className="@container flex items-center gap-x-2">
      <div className="inline-flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-text-muted">Manager:</span>
        <a
          href={manager.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open manager profile on Transfermarkt"
          className={`min-w-0 font-semibold hover:underline transition-colors truncate ${manager.isCurrentManager ? "text-accent-blue" : "text-text-muted"}`}
        >
          {manager.name}
        </a>
        <ManagerSackedBadge manager={manager} />
      </div>
      <ManagerPPGBadge manager={manager} />
    </div>
  );
}

export function ManagerPPGBadge({ manager }: ManagerPPGBadgeProps) {
  const isTouchDevice = useIsTouchDevice();

  if (manager.matches === 0) {
    return (
      <span className="inline-flex shrink-0 px-2 py-0.5 rounded text-[10px] @md:text-xs font-medium bg-elevated text-text-muted border border-border-subtle">
        <span className="@md:hidden">New</span>
        <span className="hidden @md:inline">New manager</span>
      </span>
    );
  }

  const hasRanking =
    manager.ppg !== null &&
    manager.ppgRank !== undefined &&
    manager.totalComparableManagers !== undefined;

  if (!hasRanking) {
    return (
      <span className="inline-flex text-[10px] sm:text-xs text-text-secondary">
        ({manager.matches} {manager.matches === 1 ? "game" : "games"})
      </span>
    );
  }

  const isOnly = manager.totalComparableManagers === 1;
  const isBest = manager.ppgRank === 1 && !isOnly;
  const isWorst = manager.ppgRank === manager.totalComparableManagers && !isBest && !isOnly;

  const badgeColors = isBest
    ? "bg-green-600/15 text-green-500 border-green-600/30"
    : isWorst
      ? "bg-red-600/15 text-red-500 border-red-600/30"
      : isOnly
        ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
        : "bg-elevated text-text-secondary border-border-subtle";

  const badge = (
    <span
      className={`inline-flex max-w-full items-center gap-0.5 px-1 py-0.5 @md:px-1.5 rounded text-[9px] @md:text-xs cursor-help transition-opacity hover:opacity-80 border ${badgeColors} ${isBest || isWorst || isOnly ? "font-semibold" : ""}`}
    >
      {isBest && <span className="hidden @md:inline">🏆</span>}
      {isWorst && <span className="hidden @md:inline">⚠️</span>}
      {isOnly && <span className="hidden @md:inline">👑</span>}
      <span className="@md:hidden">{manager.ppg!.toFixed(2)}</span>
      <span className="hidden @md:inline">{manager.ppg!.toFixed(2)} PPG</span>
      <span className="text-text-secondary">
        ({manager.ppgRank}/{manager.totalComparableManagers})
      </span>
    </span>
  );

  const tooltipContent = (
    <div className="space-y-2 text-xs sm:text-sm">
      <div className="text-text-secondary">
        {isOnly ? (
          <>Only manager with {manager.matches}+ games since 1995</>
        ) : (
          <>
            {isBest ? "Best" : isWorst ? "Worst" : `#${manager.ppgRank}`} PPG among{" "}
            <span className="text-text-primary">{manager.totalComparableManagers}</span> managers
            with {manager.matches}+ games since 1995
          </>
        )}
      </div>
      {!isOnly && manager.bestManager && manager.worstManager && (
        <div className="pt-2 space-y-1.5 border-t border-t-border-subtle">
          <div className="flex items-start gap-1.5">
            <span>🏆</span>
            <div>
              <a
                href={manager.bestManager.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline text-accent-green"
              >
                {manager.bestManager.name}
              </a>
              <span className="ml-1 text-text-muted">
                {manager.bestManager.ppg.toFixed(2)} PPG · {manager.bestManager.years}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <span>⚠️</span>
            <div>
              <a
                href={manager.worstManager.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline text-red-500"
              >
                {manager.worstManager.name}
              </a>
              <span className="ml-1 text-text-muted">
                {manager.worstManager.ppg.toFixed(2)} PPG · {manager.worstManager.years}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const contentClass =
    "max-w-[280px] sm:max-w-xs p-3 bg-card text-text-primary border border-border-subtle shadow-[0_8px_32px_rgba(0,0,0,0.4)]";

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span className="hidden @sm:inline text-[10px] @md:text-xs text-text-secondary">
        ({manager.matches} {manager.matches === 1 ? "game" : "games"})
      </span>
      {isTouchDevice ? (
        <Popover>
          <PopoverTrigger asChild>{badge}</PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={16}
            className={contentClass}
          >
            {tooltipContent}
          </PopoverContent>
        </Popover>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="center"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={16}
            className={contentClass}
          >
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
