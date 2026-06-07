"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { fmtS, type Card, type TeamLite } from "@/lib/wc/model";
import type { LiveModel, TrackerRow } from "@/lib/wc/live";
import "../wc/wc.css";

const j = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function WcLive({ live }: { live: LiveModel }) {
  const { model, tracker, cardByKey, liveGroups, started } = live;
  const { bracket, cardH, cardW } = model;

  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hovered ?? pinned;
  const tipRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const trackerByName: Record<string, TrackerRow> = Object.fromEntries(
    tracker.map((r) => [r.team.name, r]),
  );

  function onMove(e: React.MouseEvent) {
    const t = tipRef.current;
    if (!t) return;
    let x = e.clientX + 16;
    if (x + t.offsetWidth + 12 > window.innerWidth) x = e.clientX - t.offsetWidth - 16;
    t.style.left = `${x}px`;
    t.style.top = `${e.clientY + 18}px`;
  }

  function pinTeam(name: string) {
    const next = name === pinned ? null : name;
    setPinned(next);
    if (!next) return;
    const el = scrollRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => {
      if (!el) return;
      const cs = bracket.cards.filter((c) => {
        const lc = cardByKey[`${c.round}-${c.num}`];
        const home = lc?.home ?? c.home;
        const away = lc?.away ?? c.away;
        return home.name === next || away.name === next;
      });
      if (!cs.length) return;
      const minX = Math.min(...cs.map((c) => c.x));
      const maxX = Math.max(...cs.map((c) => c.x + cardW));
      el.scrollTo({
        left: Math.max(0, (minX + maxX) / 2 - el.clientWidth / 2),
        behavior: "smooth",
      });
    });
  }

  const hover = (name: string) => ({
    onMouseEnter: () => setHovered(name),
    onMouseLeave: () => setHovered(null),
  });

  const chip = (
    team: TeamLite,
    win: boolean,
    lose: boolean,
    pred: boolean,
    score: string | null,
  ) => (
    <div
      className={j("bt", win && "w", lose && "l", pred && "pred", active === team.name && "on")}
      {...hover(team.name)}
    >
      <span className="bf">{team.flag}</span>
      <span className="bn">{team.short}</span>
      <span className="bv">{score ?? fmtS(team.mv)}</span>
    </div>
  );

  const card = (c: Card) => {
    const lc = cardByKey[`${c.round}-${c.num}`];
    const home = lc?.home ?? c.home;
    const away = lc?.away ?? c.away;
    const winner = lc ? lc.winner : c.winner;
    const pred = !lc?.real;
    const played = !!lc?.played;
    return (
      <div
        key={c.id}
        className={j("bcard", c.isFinal && "isfinal", pred && "predcard")}
        style={{ left: c.x, top: c.y - cardH / 2, width: cardW }}
      >
        {chip(
          home,
          winner === home.name,
          !!winner && winner !== home.name,
          pred,
          played ? String(lc!.hs) : null,
        )}
        {chip(
          away,
          winner === away.name,
          !!winner && winner !== away.name,
          pred,
          played ? String(lc!.as) : null,
        )}
      </div>
    );
  };

  // champion: real once the final is decided, else the predicted one (faded)
  const finalLc = cardByKey["F-1"];
  const championName = finalLc?.played ? finalLc.winner : null;
  const crownTeam = championName
    ? (model.byName[championName] ?? bracket.crown.team)
    : bracket.crown.team;
  const crownDecided = !!championName;

  const overRows = tracker
    .filter(
      (r) =>
        r.status === "champion" ||
        r.status === "over" ||
        (r.alive && (r.actualStage ?? 0) > r.expStage),
    )
    .sort((a, b) => (b.actualStage ?? 0) - b.expStage - ((a.actualStage ?? 0) - a.expStage));
  const underRows = tracker
    .filter((r) => r.status === "under")
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

  const info = hovered ? trackerByName[hovered] : null;

  const trackRow = (r: TrackerRow, kind: "over" | "under") => {
    const d = (r.actualStage ?? 0) - r.expStage;
    return (
      <div
        key={r.team.name}
        className="trow"
        onClick={() => pinTeam(r.team.name)}
        {...hover(r.team.name)}
      >
        <span className="flag">{r.team.flag}</span>
        <span className="tn">{r.team.name}</span>
        <span className="ts">
          {r.actualLabel}
          {r.alive ? " (in)" : ""} <span className="tmut">· exp {r.expLabel}</span>
        </span>
        <span className={j("delta", kind)}>
          {kind === "over" ? "▲" : "▼"} {Math.abs(d)}
        </span>
      </div>
    );
  };

  return (
    <div className="wc-root" onMouseMove={onMove}>
      <header className="wc-hero">
        <div className="kicker">FIFA World Cup 2026 · Live vs the value model</div>
        <h1 className="wc-title">Expectations vs Reality</h1>
        <p className="rule">
          The market-value prediction, getting overwritten by real results as they come in.{" "}
          <b>vs Exp</b> tracks who is beating or falling short of the round their squad value seeds
          them into.{" "}
          <Link href="/wc" className="wc-link">
            See the full value prediction →
          </Link>
        </p>
      </header>

      {!started ? (
        <div className="wc-banner">
          ⏳ The tournament kicks off <b>Thursday 11 June 2026</b>. Until then this mirrors the
          value prediction below — it fills in with real results as matches are played (refreshed
          every 12 hours).
        </div>
      ) : (
        <div className="wc-banner live">
          🔴 Live · <b>{overRows.length}</b> teams ahead of their value seeding,{" "}
          <b>{underRows.length}</b> behind. Refreshed every 12 hours.
        </div>
      )}

      <div className="section-title">Over / Under-achievers</div>
      <p className="hint">
        Measured in knockout rounds reached vs the round each squad&apos;s market value seeds it
        into.
        {!started && " Nothing decided yet."}
      </p>
      <div className="tracker">
        <div className="track-col">
          <div className="track-head over">▲ Overachieving</div>
          {overRows.length ? (
            overRows.map((r) => trackRow(r, "over"))
          ) : (
            <div className="track-empty">—</div>
          )}
        </div>
        <div className="track-col">
          <div className="track-head under">▼ Underachieving</div>
          {underRows.length ? (
            underRows.map((r) => trackRow(r, "under"))
          ) : (
            <div className="track-empty">—</div>
          )}
        </div>
      </div>

      <div className="section-title">The Bracket {started ? "· live" : "· predicted"}</div>
      <p className="hint">
        Solid cards are real results; faded cards are the value prediction awaiting kickoff.{" "}
        <b>Hover or click</b> a team to trace its run.
        {pinned && (
          <>
            {" — "}
            <button type="button" onClick={() => setPinned(null)} className="wc-clear">
              tracing {pinned} (clear)
            </button>
          </>
        )}
      </p>
      <div ref={scrollRef} className="full-bleed wc-bracket-scroll" style={{ scrollMarginTop: 72 }}>
        <div
          className={j("bracket", active && "lit")}
          style={{ width: bracket.width, height: bracket.height }}
        >
          <svg className="lines" width={bracket.width} height={bracket.height} aria-hidden>
            {bracket.edges.map((e, i) => (
              <path key={i} d={e.d} className={active === e.team ? "on" : undefined} />
            ))}
          </svg>
          {bracket.labels.map((l, i) => (
            <div key={i} className="rlabel" style={{ left: l.x, width: cardW }}>
              {l.label}
            </div>
          ))}
          {bracket.cards.map(card)}
          <div
            className={j("crown", !crownDecided && "pred")}
            style={{ left: bracket.crown.x, top: bracket.crown.y }}
            {...hover(crownTeam.name)}
          >
            <div className="ccup">🏆</div>
            <div className="cfl">{crownTeam.flag}</div>
            <div className="cnm">{crownTeam.short}</div>
            <div className="clb">{crownDecided ? "World Champions" : "Predicted winner"}</div>
          </div>
        </div>
      </div>

      <div className="section-title">Groups {started ? "" : "· predicted"}</div>
      <div className="groups">
        {Object.entries(liveGroups).map(([g, grp]) => (
          <div key={g} className={j("group-card", !grp.live && "predcard")}>
            <div className="ghead">
              Group {g} {grp.live ? <span className="glive">live</span> : ""}
            </div>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Team</th>
                  <th>Pl</th>
                  <th>+/-</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {grp.rows.map((r) => (
                  <tr
                    key={r.team.name}
                    className={j("row", r.cls)}
                    onClick={() => pinTeam(r.team.name)}
                    {...hover(r.team.name)}
                  >
                    <td className="pos">{r.pos}</td>
                    <td className="tc">
                      <span className="flag">{r.team.flag}</span>
                      <span>{r.team.name}</span>
                    </td>
                    <td className="n">{r.pl}</td>
                    <td className="n">{r.gd}</td>
                    <td className="n pts">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <div className="legend">
        <span>
          <i style={{ background: "var(--wc-win)" }} />
          Qualifying (top 2)
        </span>
        <span>
          <i style={{ background: "var(--wc-gold)" }} />
          Best third-placed
        </span>
      </div>

      <div className="wc-foot">
        Live data from Transfermarkt · value seeding from current squad market values · refreshed
        every 12 hours.
      </div>

      <div ref={tipRef} className={j("tip", info && "show")}>
        {info && (
          <>
            <span className="tf">{info.team.flag}</span>
            {info.team.name}
            <span className="td">·</span>
            <span className="tr">{info.actualLabel}</span>
            <span className="td">exp {info.expLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
