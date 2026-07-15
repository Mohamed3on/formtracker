"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { NationalityFlag } from "@/components/NationalityFlag";
import { getPlayerDetailHref } from "@/lib/format";
import type { WcScorer } from "@/lib/wc/scorers";

type SortKey = "npga" | "goals" | "assists" | "mins";

const LIMIT = 20;

// Same ranking logic as /players: non-penalty G+A by default, ties broken by
// fewer minutes (the same output in less time ranks higher). The penalty toggle
// adds spot-kicks back into goals (and so into G+A), mirroring the players list.
export function WcScorers({ scorers, started }: { scorers: WcScorer[]; started: boolean }) {
  const [sortBy, setSortBy] = useState<SortKey>("npga");
  const [includePen, setIncludePen] = useState(false);

  const rows = useMemo(() => {
    const withVals = scorers.map((s) => {
      const goals = s.goals - (includePen ? 0 : s.penaltyGoals);
      return { s, goals, assists: s.assists, npga: goals + s.assists };
    });
    withVals.sort((a, b) => {
      let diff: number;
      switch (sortBy) {
        case "goals":
          diff = b.goals - a.goals;
          break;
        case "assists":
          diff = b.assists - a.assists;
          break;
        case "mins":
          diff = b.s.minutes - a.s.minutes;
          break;
        default:
          diff = b.npga - a.npga;
      }
      // Tiebreak: fewer minutes ranks higher (more output in less time).
      return diff || a.s.minutes - b.s.minutes;
    });
    return withVals.slice(0, LIMIT);
  }, [scorers, sortBy, includePen]);

  const pointsLabel = includePen ? "G+A" : "npG+A";
  const sorts: { key: SortKey; label: string }[] = [
    { key: "npga", label: pointsLabel },
    { key: "goals", label: "Goals" },
    { key: "assists", label: "Assists" },
    { key: "mins", label: "Mins" },
  ];

  return (
    <>
      <div className="section-title">Top Scorers {started ? "· live" : "· projected"}</div>
      <p className="hint">
        Every player&apos;s World Cup goals and assists — <b>non-penalty by default</b>, ties broken
        by fewer minutes played. Tap a metric to re-sort; toggle Penalties to fold spot-kicks back
        in.
      </p>

      <div className="scorer-controls">
        {sorts.map((s) => (
          <button
            key={s.key}
            type="button"
            className={clsx("sbtn", sortBy === s.key && "on")}
            onClick={() => setSortBy(s.key)}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          className={clsx("pen-toggle", includePen && "on")}
          aria-pressed={includePen}
          onClick={() => setIncludePen((v) => !v)}
        >
          <span className="dot" /> Penalties
        </button>
      </div>

      <div className="scorer-table">
        <table className="mv-table">
          <thead>
            <tr>
              <th className="mv-rank">#</th>
              <th>Player</th>
              <th className={clsx("r", sortBy === "npga" && "on")}>{pointsLabel}</th>
              <th className={clsx("r sc-col", sortBy === "goals" && "on")}>G</th>
              <th className={clsx("r sc-col", sortBy === "assists" && "on")}>A</th>
              <th className={clsx("r", sortBy === "mins" && "on")}>Min</th>
              <th className="r sc-col">GP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, goals, assists, npga }, i) => (
              <tr key={s.playerId}>
                <td className="mv-rank">{i + 1}</td>
                <td className="mv-team">
                  <span className="sc-player">
                    <PlayerAvatar imageUrl={s.imageUrl} name={s.name} className="sc-av" />
                    <Link href={getPlayerDetailHref(s.playerId)} className="sc-name">
                      {s.name}
                    </Link>
                    <NationalityFlag url={s.flagUrl} name={s.nationality} />
                    {s.clubLogoUrl && (
                      <img className="sc-club" src={s.clubLogoUrl} alt={s.club} title={s.club} />
                    )}
                  </span>
                </td>
                <td className="r sc-pts font-value">{npga}</td>
                <td className="r sc-col font-value">{goals}</td>
                <td className="r sc-col font-value">{assists}</td>
                <td className="r sc-min font-value">{s.minutes}&apos;</td>
                <td className="r sc-col font-value">{s.apps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
