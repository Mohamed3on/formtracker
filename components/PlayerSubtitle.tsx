import Link from "next/link";
import { PositionDisplay } from "@/components/PositionDisplay";
import { NationalityFlag } from "@/components/NationalityFlag";
import { ClubLogo } from "@/components/ClubLogo";
import { getNationalityHref, getTeamDetailHref } from "@/lib/format";

interface PlayerSubtitleProps {
  position: string;
  playedPosition?: string;
  club: string;
  clubLogoUrl?: string;
  clubId?: string;
  age: number;
  nationalityFlagUrl?: string;
  nationality?: string;
}

export function PlayerSubtitle({
  position,
  playedPosition,
  club,
  clubLogoUrl,
  clubId,
  age,
  nationalityFlagUrl,
  nationality,
}: PlayerSubtitleProps) {
  const clubContent = (
    <span className="inline-flex items-center gap-1">
      {clubLogoUrl && <ClubLogo src={clubLogoUrl} />}
      {club}
    </span>
  );

  return (
    <>
      <PositionDisplay position={position} playedPosition={playedPosition} abbreviated />
      {nationalityFlagUrl && (
        <>
          <span className="opacity-40">•</span>
          {nationality ? (
            <Link
              href={getNationalityHref(nationality)}
              aria-label={`Players from ${nationality}`}
              className="inline-flex transition-opacity hover:opacity-70"
            >
              <NationalityFlag url={nationalityFlagUrl} name={nationality} />
            </Link>
          ) : (
            <NationalityFlag url={nationalityFlagUrl} />
          )}
        </>
      )}
      <span className="opacity-40">•</span>
      {clubId ? (
        <Link
          href={getTeamDetailHref(clubId)}
          className="inline-flex items-center gap-1 hover:underline"
        >
          {clubLogoUrl && <ClubLogo src={clubLogoUrl} />}
          {club}
        </Link>
      ) : (
        clubContent
      )}
      <span className="opacity-40">•</span>
      <span>{age}y</span>
    </>
  );
}
