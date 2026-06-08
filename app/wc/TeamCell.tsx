import type { TeamLite } from "@/lib/wc/model";
import { PlayersLink } from "./PlayersLink";

// Shared team-name cell for the value tables: flag, name, and a players link
// when that nation has players on /players.
export function TeamCell({
  team,
  playerLinks,
}: {
  team: TeamLite;
  playerLinks: Record<string, string>;
}) {
  return (
    <td className="mv-team">
      <span className="flag">{team.flag}</span>
      {team.name}
      {playerLinks[team.name] && <PlayersLink href={playerLinks[team.name]} team={team.name} />}
    </td>
  );
}
