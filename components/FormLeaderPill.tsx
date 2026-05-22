import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Linkable pill for teams that lead or trail recent-form categories.
 * Compact variant fits inside table rows; default sits next to a team name.
 */
export function FormLeaderPill({
  type,
  compact = false,
}: {
  type: "top" | "bottom";
  compact?: boolean;
}) {
  const isTop = type === "top";
  const colors = isTop
    ? "bg-[var(--accent-hot-glow)] text-[var(--accent-hot)]"
    : "bg-[var(--accent-cold-glow)] text-[var(--accent-cold)]";

  if (compact) {
    return (
      <Link
        href="/form"
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:brightness-125",
          colors,
        )}
      >
        {isTop ? "↑" : "↓"}
        <span className="hidden sm:inline"> form</span>
      </Link>
    );
  }

  return (
    <Link
      href="/form"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold transition-all duration-150 hover:scale-105 hover:brightness-125",
        colors,
      )}
    >
      {isTop ? "↑ Best" : "↓ Worst"} form <span className="text-[8px] opacity-60">→</span>
    </Link>
  );
}
