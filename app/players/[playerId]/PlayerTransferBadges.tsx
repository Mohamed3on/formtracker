import { AccoladeBadge } from "@/components/AccoladeBadge";
import { playerAccolades } from "@/lib/fee-vs-value-rankings";
import { getFeeVsValueData } from "@/lib/top-transfers";

/**
 * Any fee-vs-value list this player's move currently heads.
 *
 * Its own fetch behind its own `<Suspense>`, like `PlayerInjuryBadge`: the hero
 * should not wait on a transfer scrape to paint, and a Transfermarkt outage
 * must not take a player page down over a decoration — hence the `catch`.
 *
 * Silent for all but a handful of players, which is the point. Only the four
 * cash-and-value lists carry an accolade; the two times-value ones are left out
 * deliberately, since `3.50×` on a hero badge, away from the page that explains
 * the measure, reads as a euro figure to anyone who hasn't been there.
 */
export async function PlayerTransferBadges({ playerId }: { playerId: string }) {
  const data = await getFeeVsValueData().catch(() => null);
  if (!data) return null;

  return (
    <>
      {playerAccolades(data.transfers, playerId).map((a) => (
        <AccoladeBadge
          key={a.href}
          label={a.title}
          figure={a.figure}
          href={a.href}
          tone={a.tone}
          season={data.season}
        />
      ))}
    </>
  );
}
