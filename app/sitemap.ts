import {getSquadPlayerIndex} from "@/lib/teamSquads";
import bundledSnapshot from "@/data/supabase-snapshot.json";
import fs from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

type SnapshotCompetition = {
  slug?: string | null;
};

type SnapshotTeam = {
  slug?: string | null;
};

type SnapshotData = {
  generatedAt?: string;
  competitions?: SnapshotCompetition[];
  teams?: SnapshotTeam[];
};

function readSnapshot(): SnapshotData {
  const snapshotPath = path.join(process.cwd(), "data", "supabase-snapshot.json");

  try {
    return JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as SnapshotData;
  } catch {
    return bundledSnapshot;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const snapshot = readSnapshot();
  const lastModified = snapshot.generatedAt ? new Date(snapshot.generatedAt) : new Date();

  const staticRoutes = [
    "",
    "/leagues",
    "/news",
    "/watch",
    "/sources",
    "/agenda",
    "/weekly",
    "/weekly/week-1",
    "/about",
    "/advertise",
    "/games",
    "/privacy",
    "/terms",
    "/rugby-results",
    "/rugby-fixtures",
    "/rugby-live-scores",
    "/rugby-matches",
    "/six-nations-standings",
    "/super-rugby-results",
  ];

  const staticEntries = staticRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: route === "/agenda" ? new Date("2026-10-19T00:00:00Z") : lastModified,
    changeFrequency: route === "" ? "hourly" : "daily",
    priority: route === "" ? 1 : 0.8,
  })) satisfies MetadataRoute.Sitemap;

  const leagueEntries = (snapshot.competitions ?? [])
    .map((competition) => competition.slug?.trim())
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({
      url: `${siteUrl}/leagues/${slug}`,
      lastModified,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    }));

  const teamEntries = (snapshot.teams ?? [])
    .map((team) => team.slug?.trim())
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({
      url: `${siteUrl}/teams/${slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const playerEntries=getSquadPlayerIndex().map(p=>({url:`${siteUrl}/players/${p.id}`,lastModified:new Date(p.checkedAt),changeFrequency:"weekly" as const,priority:0.5}));
  return [...staticEntries, ...leagueEntries, ...teamEntries,...playerEntries];
}
