import Link from "next/link";
import type { ReactNode } from "react";
import { SignalBadge } from "@/components/SignalBadge";
import { InfoTip } from "@/app/components/InfoTip";
import { TOP_TRANSFER_LIMIT } from "@/lib/constants";
import { seasonLabel, type Tone } from "@/lib/fee-vs-value-rankings";

/** The page's own colour key, borrowed intact: green is the good outcome and
 *  red the bad one, whichever side of a deal you are reading from. */
const TONE_BADGE: Record<Tone, string> = {
  over: "border-accent-cold-border bg-accent-cold-glow text-accent-cold-soft",
  under: "border-accent-hot-border bg-accent-hot-glow text-accent-hot",
  neutral: "border-border-subtle bg-card-hover text-text-secondary",
};

/**
 * One fee-vs-value fact, carried onto a player's or a club's own page.
 *
 * The badge has to survive away from the page that frames it, which is what the
 * tip is for: a hero badge reading "Most expensive signing" says nothing about
 * *when*, and a figure drawn from the biggest transfers of a season is not the same
 * claim as one drawn from every deal a club did. Both are stated once here
 * rather than in each caller, so the two pages cannot end up describing the
 * same number differently.
 *
 * The link sits inside the badge rather than around it: an `InfoTip` is a
 * tooltip on a pointer and a popover on a touchscreen, and wrapping the pair in
 * an anchor would navigate away on the tap that was meant to open it.
 */
export function AccoladeBadge({
  label,
  figure,
  note,
  href,
  tone,
  season,
  children,
}: {
  label: string;
  figure: string;
  /** A qualifier the label needs to be true, dimmed because it is a condition
   *  on the claim rather than part of it. */
  note?: string;
  href: string;
  tone: Tone;
  season: number;
  /** Anything the standard scope note doesn't already cover. */
  children?: ReactNode;
}) {
  return (
    <SignalBadge className={TONE_BADGE[tone]}>
      <Link href={href} className="hover:underline">
        {label} · <span className="font-value">{figure}</span>
        {note && <span className="opacity-70"> · {note}</span>}
      </Link>
      <InfoTip className="ml-1">
        <p>
          Measured across the <span className="font-value">{TOP_TRANSFER_LIMIT}</span> biggest
          transfers of the <span className="font-value">{seasonLabel(season)}</span> season, each
          fee held against what Transfermarkt says the player is worth.
        </p>
        {children}
      </InfoTip>
    </SignalBadge>
  );
}
