import { NextResponse } from "next/server";
import type { PlayerStats } from "@/app/types";
import { getPlayerStatsData, applyStatsToggles } from "@/lib/fetch-minutes-value";
import {
  canBeOutperformerAgainst,
  canBeUnderperformerAgainst,
  effectivePosition as pos,
  strictlyOutperforms,
} from "@/lib/positions";
import { normalizeForSearch } from "@/lib/normalize";

function findPlayerByName(players: PlayerStats[], searchName: string): PlayerStats | null {
  const normalized = normalizeForSearch(searchName);
  return players.find((p) => normalizeForSearch(p.name).includes(normalized)) || null;
}

function findUnderperformers(players: PlayerStats[], target: PlayerStats): PlayerStats[] {
  return players.filter(
    (p) =>
      p.playerId !== target.playerId &&
      p.marketValue >= target.marketValue &&
      strictlyOutperforms(target, p),
  );
}

function findOutperformers(players: PlayerStats[], target: PlayerStats): PlayerStats[] {
  return players.filter(
    (p) =>
      p.playerId !== target.playerId &&
      p.marketValue <= target.marketValue &&
      strictlyOutperforms(p, target),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("id");
  const playerName = searchParams.get("name");
  const includePen = searchParams.get("pen") === "1";

  if (!playerId && !playerName) {
    return NextResponse.json({ error: "Player id or name is required" }, { status: 400 });
  }

  try {
    const rawPlayers = await getPlayerStatsData();
    const allPlayers = applyStatsToggles(rawPlayers, { includePen });

    const targetPlayer =
      (playerId && allPlayers.find((p) => p.playerId === playerId)) ||
      (playerName && findPlayerByName(allPlayers, playerName)) ||
      null;

    if (!targetPlayer) {
      return NextResponse.json(
        {
          error: "Player not found",
          searchedName: playerName || playerId,
          totalPlayers: allPlayers.length,
        },
        { status: 404 },
      );
    }

    const tp = pos(targetPlayer);
    const underperformers = findUnderperformers(allPlayers, targetPlayer).filter((p) =>
      canBeUnderperformerAgainst(pos(p), tp),
    );
    const outperformers = findOutperformers(allPlayers, targetPlayer)
      .filter((p) => canBeOutperformerAgainst(pos(p), tp))
      .sort((a, b) => b.points - a.points || a.marketValue - b.marketValue);

    return NextResponse.json({
      targetPlayer,
      underperformers,
      outperformers,
      totalPlayers: allPlayers.length,
    });
  } catch (error) {
    console.error("Error analyzing player form:", error);
    return NextResponse.json({ error: "Failed to analyze player form" }, { status: 500 });
  }
}
