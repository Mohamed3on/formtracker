"use client";

import Link from "next/link";
import { Users } from "lucide-react";

// Small icon button next to a nation name → that nation's players on /players.
export function PlayersLink({ href, team }: { href: string; team: string }) {
  return (
    <Link
      href={href}
      className="nat-players"
      title={`${team} players`}
      aria-label={`View ${team} players`}
      onClick={(e) => e.stopPropagation()}
    >
      <Users size={13} aria-hidden />
    </Link>
  );
}
