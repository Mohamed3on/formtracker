import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: number;
  highlightClass?: string;
}

export function RankBadge({
  rank,
  highlightClass = "bg-accent-hot text-background",
}: RankBadgeProps) {
  return (
    <div
      className={cn(
        "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-value text-xs sm:text-sm shrink-0",
        rank <= 3 ? highlightClass : "bg-elevated text-text-muted",
      )}
    >
      {rank}
    </div>
  );
}
