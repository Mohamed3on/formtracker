import type { MetadataRoute } from "next";
import { DISCOVERY_PRESETS, getPresetTargetHref } from "@/lib/discovery-presets";
import { LEAGUES } from "@/lib/leagues";
import { absoluteUrl } from "@/lib/site-config";

const CORE_ROUTES = [
  "/",
  "/discover",
  "/form",
  "/expected-position",
  "/players",
  "/value-analysis",
  "/injured",
  "/biggest-movers",
  "/wc-live",
  "/wc",
  "/wc-schedule",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const curatedHrefs = Array.from(
    new Set(DISCOVERY_PRESETS.map((preset) => getPresetTargetHref(preset))),
  );
  const coreHrefSet = new Set(CORE_ROUTES);
  const coreEntries: MetadataRoute.Sitemap = CORE_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : path === "/discover" ? 0.9 : 0.8,
  }));
  const leagueEntries: MetadataRoute.Sitemap = LEAGUES.map((l) => ({
    url: absoluteUrl(`/leagues/${l.slug}`),
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.85,
  }));
  const curatedEntries: MetadataRoute.Sitemap = curatedHrefs
    .filter((href) => !coreHrefSet.has(href as (typeof CORE_ROUTES)[number]))
    .map((href) => ({
      url: absoluteUrl(href),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    }));

  return [...coreEntries, ...leagueEntries, ...curatedEntries];
}
