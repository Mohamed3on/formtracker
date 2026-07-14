import * as cheerio from "cheerio";
import { tmImage } from "./image";

/**
 * Everything the player-profile data-header carries. Owns Transfermarkt's
 * *presentation* vocabulary (the ribbon wording, the U-squad caps rule, the
 * market-value display). Cross-source reconciliation (these header caps vs the
 * alpha API) and value typing (`parseMarketValue` on `marketValueText`) stay with
 * the caller.
 */
export interface ProfileHeader {
  club: string;
  clubId: string;
  clubLogoUrl: string;
  isOnLoan: boolean;
  isNewSigning: boolean;
  nationality: string;
  nationalityFlagUrl: string;
  leagueLogoUrl: string;
  contractExpiry?: string;
  /** The market value exactly as displayed (e.g. "€180.00m"); caller parses it. */
  marketValueText: string;
  age: number;
  /** Senior caps from the header — a fallback for when the alpha API is down. */
  headerCaps: number;
  headerIsCurrentSenior: boolean;
}

/** Parse the data-header of a Transfermarkt player profile / performance page. */
export function parseProfileHeader(html: string): ProfileHeader {
  const $ = cheerio.load(html);

  const clubInfo = $(".data-header__club-info");
  const club = clubInfo.find(".data-header__club a").text().trim();
  const clubAnchor = $(".data-header__box__club-link").first();
  const clubLogoImg = clubAnchor.find("img").first();
  // The club crest ships as a srcset; the first entry is already the largest.
  const clubLogoSrcset = (clubLogoImg.attr("srcset") || "").trim();
  const clubLogoUrl = clubLogoSrcset.split(/\s+/)[0] || clubLogoImg.attr("src") || "";
  const clubId = (clubAnchor.attr("href") || "").match(/\/verein\/(\d+)/)?.[1] ?? "";

  const ribbonText = $(".data-header__ribbon span").text().trim().toLowerCase();
  const isOnLoan = ribbonText === "on loan";
  const isNewSigning = ribbonText === "new arrival" || ribbonText === "winter signing" || isOnLoan;

  const natFlagImg = $("span[itemprop='nationality'] img.flaggenrahmen").first();
  const nationality = natFlagImg.attr("title") || "";
  const nationalityFlagUrl = tmImage(natFlagImg.attr("src") || "");

  const leagueLinkImg = $(".data-header__league-link img").first();
  const leagueLogoUrl = tmImage(leagueLinkImg.attr("src") || "");

  // The header shows only the player's current national team; skip youth squads
  // (their name contains "U21", "U19", …) so caps aren't counted as senior.
  const capsLi = $("li:contains('Caps/Goals')").first();
  const capsUl = capsLi.closest("ul");
  const natTeamName = capsUl.find("a[href*='/startseite/verein/']").first().attr("title") || "";
  const headerIsSenior = !!natTeamName && !/U\d/i.test(natTeamName);
  const headerCaps = headerIsSenior ? parseInt(capsLi.find("a").first().text().trim()) || 0 : 0;
  const ntLabel = capsUl.find(".data-header__label").first().text().trim().toLowerCase();
  const headerIsCurrentSenior = headerIsSenior && ntLabel.includes("current international");

  const contractLabel = clubInfo.find(".data-header__label:contains('Contract expires:')");
  const contractExpiry = contractLabel.find(".data-header__content").text().trim() || undefined;

  // The wrapper holds the value plus a trailing <p> (the "as of" date); drop the
  // <p> and read what's left.
  const mvEl = $(".data-header__market-value-wrapper");
  const marketValueText = mvEl.clone().children("p").remove().end().text().trim();

  const ageMatch = $("span[itemprop='birthDate']")
    .text()
    .trim()
    .match(/\((\d+)\)/);
  const age = ageMatch ? parseInt(ageMatch[1]) : 0;

  return {
    club,
    clubId,
    clubLogoUrl,
    isOnLoan,
    isNewSigning,
    nationality,
    nationalityFlagUrl,
    leagueLogoUrl,
    contractExpiry,
    marketValueText,
    age,
    headerCaps,
    headerIsCurrentSenior,
  };
}
