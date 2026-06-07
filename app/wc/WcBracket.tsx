"use client";

import { useRef, useState } from "react";
import { MODEL, fmt, fmtS, type Card, type RankRow, type TeamLite } from "./sim";
import "./wc.css";

const j = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const { bracket, cardH, cardW } = MODEL;
const knockoutTeams = new Set(bracket.cards.flatMap((c) => [c.home.name, c.away.name]));

export function WcBracket() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hovered ?? pinned;

  const tipRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const cards = bracket.cards.filter((c) => c.home.name === next || c.away.name === next);
      if (!cards.length) return;
      const minX = Math.min(...cards.map((c) => c.x));
      const maxX = Math.max(...cards.map((c) => c.x + cardW));
      el.scrollTo({
        left: Math.max(0, (minX + maxX) / 2 - el.clientWidth / 2),
        behavior: "smooth",
      });
    });
  }

  const hoverProps = (name: string) => ({
    onMouseEnter: () => setHovered(name),
    onMouseLeave: () => setHovered(null),
  });

  const chip = (team: TeamLite, win: boolean) => (
    <div
      className={j("bt", win ? "w" : "l", active === team.name && "on")}
      {...hoverProps(team.name)}
    >
      <span className="bf">{team.flag}</span>
      <span className="bn">{team.short}</span>
      <span className="bv">{fmtS(team.mv)}</span>
    </div>
  );

  const card = (c: Card) => (
    <div
      key={c.id}
      className={j("bcard", c.isFinal && "isfinal")}
      style={{ left: c.x, top: c.y - cardH / 2, width: cardW }}
    >
      {chip(c.home, c.home.name === c.winner)}
      {chip(c.away, c.away.name === c.winner)}
    </div>
  );

  const info = hovered ? MODEL.info[hovered] : null;

  return (
    <div className="wc-root" onMouseMove={onMove}>
      <header className="wc-hero">
        <div className="kicker">FIFA World Cup 2026 · USA · Canada · Mexico</div>
        <h1 className="wc-title">The Market-Value World Cup</h1>
        <p className="rule">
          A fully deterministic run where, in every single match,{" "}
          <b>the higher squad market value always wins</b> — no draws, no upsets.
        </p>
      </header>

      <div className="podiums">
        {MODEL.podium.map((p, i) => (
          <div key={p.team.name} className={j("podium", p.cls)} {...hoverProps(p.team.name)}>
            <div className="medal">{["🥇", "🥈", "🥉", "4"][i]}</div>
            <div className="pflag">{p.team.flag}</div>
            <div className="pname">{p.team.name}</div>
            <div className="pword">{p.word}</div>
            <div className="pmv">{fmt(p.team.mv)}</div>
          </div>
        ))}
      </div>

      <div className="section-title">The Bracket</div>
      <p className="hint">
        Winners flow toward the centre. <b>Hover</b> any team to trace its run and see the round it
        reached
        {pinned ? (
          <>
            {" — "}
            <button
              type="button"
              onClick={() => setPinned(null)}
              style={{
                color: "var(--wc-gold)",
                fontWeight: 600,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
              }}
            >
              tracing {pinned} (clear)
            </button>
          </>
        ) : (
          <>
            , or <b>click a row below</b> to pin it.
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
            className="crown"
            style={{ left: bracket.crown.x, top: bracket.crown.y }}
            {...hoverProps(bracket.crown.team.name)}
          >
            <div className="ccup">🏆</div>
            <div className="cfl">{bracket.crown.team.flag}</div>
            <div className="cnm">{bracket.crown.team.short}</div>
            <div className="clb">World Champions</div>
          </div>
          <div className="tpp" style={{ left: bracket.third.x, top: bracket.third.y, width: 180 }}>
            <div className="tplb">🥉 Third place</div>
            <div className="bcard" style={{ width: 180 }}>
              {chip(bracket.third.home, bracket.third.home.name === bracket.third.winner)}
              {chip(bracket.third.away, bracket.third.away.name === bracket.third.winner)}
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">Every Team by Market Value</div>
      <p className="hint">
        Sorted by squad value. <b>Click a team</b> to trace its path above. <b>vs Exp</b> shows how
        many knockout rounds further (▲) or shorter (▼) a team went than its market-value seeding
        predicts — ranks 5–8 are seeded to the quarters, 9–16 to the last 16, and so on.
      </p>
      <div className="mv-grid">
        <PlacementTable
          rows={MODEL.ranked.slice(0, 24)}
          pinned={pinned}
          onPin={pinTeam}
          hoverProps={hoverProps}
        />
        <PlacementTable
          rows={MODEL.ranked.slice(24)}
          pinned={pinned}
          onPin={pinTeam}
          hoverProps={hoverProps}
        />
      </div>

      <div className="section-title">Group Stage</div>
      <div className="groups">
        {MODEL.groups.map((grp) => (
          <div key={grp.g} className="group-card">
            <div className="ghead">Group {grp.g}</div>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Team</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {grp.rows.map((r) => (
                  <tr key={r.team.name} className={j("row", r.cls)} {...hoverProps(r.team.name)}>
                    <td className="pos">
                      {r.pts === 9 ? 1 : r.pts === 6 ? 2 : r.pts === 3 ? 3 : 4}
                    </td>
                    <td className="tc">
                      <span className="flag">{r.team.flag}</span>
                      <span>{r.team.name}</span>
                    </td>
                    <td className="n">{r.w}</td>
                    <td className="n">{r.l}</td>
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
          Qualified (top 2)
        </span>
        <span>
          <i style={{ background: "var(--wc-gold)" }} />
          Qualified as one of 8 best third-placed teams
        </span>
      </div>

      <div className="wc-foot">
        Built from Transfermarkt squad market values · higher value wins every match.
      </div>

      <div ref={tipRef} className={j("tip", info && "show")}>
        {info && (
          <>
            <span className="tf">{info.flag}</span>
            {hovered}
            <span className="td">·</span>
            <span className="tr">{info.round}</span>
          </>
        )}
      </div>
    </div>
  );
}

function DeltaCell({ delta }: { delta: number }) {
  if (delta === 0) return <span className="delta met">— met</span>;
  const n = Math.abs(delta);
  const rounds = `${n} round${n > 1 ? "s" : ""}`;
  if (delta > 0)
    return (
      <span className="delta over" title={`Went ${rounds} further than its value seeding`}>
        ▲ {n}
      </span>
    );
  return (
    <span className="delta under" title={`Fell ${rounds} short of its value seeding`}>
      ▼ {n}
    </span>
  );
}

function PlacementTable({
  rows,
  pinned,
  onPin,
  hoverProps,
}: {
  rows: RankRow[];
  pinned: string | null;
  onPin: (name: string) => void;
  hoverProps: (name: string) => { onMouseEnter: () => void; onMouseLeave: () => void };
}) {
  const clickable = (name: string) => knockoutTeams.has(name);
  return (
    <table className="mv-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th className="r">Value</th>
          <th>Finish</th>
          <th className="r">Pos</th>
          <th className="r">vs Exp</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const canPin = clickable(r.team.name);
          return (
            <tr
              key={r.team.name}
              className={j(canPin && "row", pinned === r.team.name && "pinned")}
              onClick={canPin ? () => onPin(r.team.name) : undefined}
              {...hoverProps(r.team.name)}
            >
              <td className="mv-rank">{r.rank}</td>
              <td className="mv-team">
                <span className="flag">{r.team.flag}</span>
                {r.team.name}
              </td>
              <td className="mv-val r">{fmtS(r.team.mv)}</td>
              <td>
                <span className={j("pill", r.finishCls)}>{r.finishLabel}</span>
              </td>
              <td className="mv-pos r">{r.posLabel}</td>
              <td className="r">
                <DeltaCell delta={r.delta} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
