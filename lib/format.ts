export const PROFIL_RE = /\/profil\//;

export function formatMarketValue(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}€${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)}K`;
  return `${sign}€${abs}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatReturnInfo(dateStr: string): { label: string; imminent: boolean } | null {
  if (!dateStr) return null;
  const [d, m, y] = dateStr.split("/").map(Number);
  if (!d || !m || !y) return null;
  const target = Date.UTC(y, m - 1, d);
  const n = new Date();
  const now = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const days = Math.ceil((target - now) / 86400000);
  const mon = MONTHS[m - 1];
  if (days <= 0) return { label: `back ${mon} ${d}`, imminent: true };
  if (days <= 14) return { label: `back in ${days} days`, imminent: true };
  if (days <= 60) return { label: `back in ~${Math.ceil(days / 7)} wks`, imminent: false };
  return { label: `back ${mon} ${d}`, imminent: false };
}

export function formatInjuryDuration(sinceStr: string): string | null {
  if (!sinceStr) return null;
  const [d, m, y] = sinceStr.split("/").map(Number);
  if (!d || !m || !y) return null;
  const since = Date.UTC(y, m - 1, d);
  const n = new Date();
  const now = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const days = Math.max(0, Math.floor((now - since) / 86400000));
  if (days < 14) return `${days} days`;
  if (days < 45) return `${Math.round(days / 7)} wks`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 mo" : `${months} mos`;
}

export function getLeistungsdatenUrl(profileUrl: string): string {
  const now = new Date();
  const season = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `https://www.transfermarkt.com${profileUrl.replace(PROFIL_RE, "/leistungsdaten/")}/saison/${season}/plus/1`;
}

export function getPlayerDetailHref(playerId: string): string {
  return `/players/${playerId}`;
}

export function getPlayerIdFromProfileUrl(profileUrl: string): string | null {
  return profileUrl.match(/\/spieler\/(\d+)/)?.[1] ?? null;
}

export function formatValueStr(value: string): string {
  return value || "-";
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function getTeamDetailHref(clubId: string): string {
  return `/teams/${clubId}`;
}

export function getNationalityHref(nationality: string): string {
  return `/players?nat=${encodeURIComponent(nationality)}`;
}

export function extractClubIdFromLogoUrl(url?: string): string | null {
  if (!url) return null;
  return url.match(/\/(\d+)\.png/)?.[1] ?? null;
}
