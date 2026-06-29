import { BASE_URL } from "@/lib/constants";

// Transfermarkt national-team "verein" ids, keyed by our roster name. National-team
// pages keep the same id forever, so this is static reference data (like landId).
// Any slug resolves — TM redirects /x/.../verein/{id} to the canonical page, the same
// pattern /teams/[clubId] uses.
const TM_TEAM_ID: Record<string, number> = {
  Mexico: 6303,
  Czechia: 3445,
  "South Korea": 3589,
  "South Africa": 3806,
  Switzerland: 3384,
  Canada: 3510,
  "Bosnia-Herzegovina": 3446,
  Qatar: 14162,
  Brazil: 3439,
  Morocco: 3575,
  Scotland: 3380,
  Haiti: 14161,
  Turkiye: 3381,
  "United States": 3505,
  Paraguay: 3581,
  Australia: 3433,
  Germany: 3262,
  "Ivory Coast": 3591,
  Ecuador: 5750,
  Curaçao: 32364,
  Netherlands: 3379,
  Sweden: 3557,
  Japan: 3435,
  Tunisia: 3670,
  Belgium: 3382,
  Egypt: 3672,
  "New Zealand": 9171,
  Iran: 3582,
  Spain: 3375,
  Uruguay: 3449,
  "Cape Verde": 4311,
  "Saudi Arabia": 3807,
  France: 3377,
  Norway: 3440,
  Senegal: 3499,
  Iraq: 3560,
  Argentina: 3437,
  Algeria: 3614,
  Austria: 3383,
  Jordan: 15737,
  Portugal: 3300,
  Colombia: 3816,
  "DR Congo": 3854,
  Uzbekistan: 3563,
  England: 3299,
  Croatia: 3556,
  Ghana: 3441,
  Panama: 3577,
};

/** That nation's Transfermarkt "verein" id, or undefined if we don't have it. */
export const wcTeamTmId = (name: string): number | undefined => TM_TEAM_ID[name];

/** That nation's Transfermarkt team page, or undefined if we don't have its id. */
export const wcTeamTmUrl = (name: string): string | undefined => {
  const id = wcTeamTmId(name);
  return id ? `${BASE_URL}/x/startseite/verein/${id}` : undefined;
};
