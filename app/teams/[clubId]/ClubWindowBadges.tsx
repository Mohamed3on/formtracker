import { AccoladeBadge } from "@/components/AccoladeBadge";
import { TOP_TRANSFER_LIMIT } from "@/lib/constants";
import { CLUB_MODES, PATH, clubWindowSummary, gainTone } from "@/lib/fee-vs-value-rankings";
import { formatPremium } from "@/lib/format";
import { getFeeVsValueData } from "@/lib/top-transfers";

const SQUAD_VALUE = CLUB_MODES["squad-value"];

/**
 * What this club's window came to, and any club table it heads.
 *
 * Every club that did business among the season's biggest transfers gets the
 * standing figure — value in minus value out, which is the one number that says
 * whether a window strengthened a squad rather than merely churned it. The six
 * table ends each badge whichever club leads them on top of that.
 *
 * A club leading the squad-value table would then print its net value twice, so
 * that accolade absorbs the standing figure instead of sitting beside a copy of
 * it. Nothing renders at all for a club with no deals in the top 250 — a
 * handful of the big five, and most clubs below them.
 *
 * Accolades read both cuts of the window and name the cut only where the two
 * disagree about the winner — see `clubAccolades`.
 *
 * Same shape as `PlayerTransferBadges`: own fetch, own `<Suspense>`, failure
 * swallowed rather than taken out on the page around it.
 */
export async function ClubWindowBadges({ clubId }: { clubId: string }) {
  const data = await getFeeVsValueData().catch(() => null);
  if (!data) return null;
  const summary = clubWindowSummary(data.transfers, clubId);
  if (!summary) return null;

  const { club, accolades } = summary;
  const ledSquadValue = accolades.some((a) => a.mode === "squad-value");

  return (
    <>
      {accolades.map((a) => (
        <AccoladeBadge
          key={a.href}
          label={a.title}
          figure={a.figure}
          note={a.note}
          href={a.href}
          tone={a.tone}
          season={data.season}
        >
          <p className="mt-1.5">
            {a.note
              ? `Read over ${a.note}. The other cut of the window has a different club at the top of this table.`
              : "Top of this table whether loans are counted or not."}
          </p>
        </AccoladeBadge>
      ))}
      {!ledSquadValue && (
        <AccoladeBadge
          label="Squad value this window"
          figure={formatPremium(club.netValue)}
          href={`${PATH}?view=clubs&by=${SQUAD_VALUE.slug}`}
          // The page's colour key, not the arithmetic sign: gaining value is the
          // good outcome, and good is the same green a bargain gets.
          tone={gainTone(club.netValue)}
          season={data.season}
        >
          <p className="mt-1.5">
            What arrived minus what left, by market value rather than by fee, loans counted. Deals
            below the top {TOP_TRANSFER_LIMIT} aren&apos;t in it.
          </p>
        </AccoladeBadge>
      )}
    </>
  );
}
