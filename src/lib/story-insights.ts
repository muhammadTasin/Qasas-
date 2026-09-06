import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { approximateLocation, visitorLabel } from "./analytics";
import { deviceLabel, normalizeText } from "./device-info";

export class StoryInsightsDenied extends Error {
  constructor() { super("Story not found"); }
}

type ReaderKind = "Logged in" | "Guest" | "Legacy";
type DeviceCategory = "Android" | "iPhone" | "PC / Laptop" | "Other";
type SummaryRow = { kind: ReaderKind; category: DeviceCategory; count: bigint; readSeconds: bigint };
type ReaderRow = {
  id: string; visitorId: string | null; ipHash: string | null;
  deviceModel: string | null; devicePlatform: string | null; deviceArchitecture: string | null;
  deviceType: string | null; os: string | null; browser: string | null;
  country: string | null; region: string | null; city: string | null;
  kind: ReaderKind; category: DeviceCategory; readerName: string | null;
  readerReadSeconds: bigint; readerFirstSeenAt: Date; lastSeenAt: Date;
};
const RECENT_READERS_PER_KIND = 20;

// Browser streams retain their existing uniqueness/read-time gate. PostgreSQL
// combines signed-in streams by Qasas user; guests/legacy keep their row identity.
// Window functions retain the latest device without fetching all views into JS.
function readersQuery(storyId: string) {
  return Prisma.sql`
    WITH base AS (
      SELECT v.*,
        CASE WHEN "userId" IS NOT NULL AND "isAuthenticated" IS TRUE THEN 'user:' || "userId" ELSE 'view:' || id END AS "readerKey",
        CASE WHEN "userId" IS NOT NULL AND "isAuthenticated" IS TRUE THEN 'Logged in'
             WHEN "isAuthenticated" IS FALSE THEN 'Guest' ELSE 'Legacy' END AS kind
      FROM "StoryView" v WHERE "storyId" = ${storyId}
    ), ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY "readerKey" ORDER BY "lastSeenAt" DESC, id DESC) AS "readerRank",
        SUM("totalReadSeconds") OVER (PARTITION BY "readerKey") AS "readerReadSeconds",
        MIN("firstSeenAt") OVER (PARTITION BY "readerKey") AS "readerFirstSeenAt"
      FROM base
    ), readers AS (
      SELECT *, CASE
        WHEN COALESCE("deviceType", '') NOT IN ('smarttv', 'console', 'wearable', 'embedded')
          AND COALESCE(NULLIF("devicePlatform", ''), os, '') ~* 'android' THEN 'Android'
        WHEN COALESCE("deviceType", '') <> 'tablet' AND COALESCE("deviceModel", '') !~* '^ipad'
          AND (COALESCE(NULLIF("devicePlatform", ''), os, '') ~* 'ios|iphone' OR COALESCE("deviceModel", '') ~* '^iphone') THEN 'iPhone'
        WHEN COALESCE("deviceType", 'desktop') = 'desktop'
          AND COALESCE(NULLIF("devicePlatform", ''), os, '') ~* 'linux|windows|mac|chrome|chromium|cros' THEN 'PC / Laptop'
        ELSE 'Other' END AS category
      FROM ranked WHERE "readerRank" = 1
    )`;
}

export async function getStoryInsights(storyId: string, ownerId: string) {
  return prisma.$transaction(async tx => {
    // Enforced here as well as by the signed-in route, before any reader names.
    const story = await tx.story.findFirst({ where: { id: storyId, authorId: ownerId, deletedAt: null }, select: { id: true } });
    if (!ownerId || !story) throw new StoryInsightsDenied();
    const query = readersQuery(storyId);
    const [groups, recent] = await Promise.all([
      tx.$queryRaw<SummaryRow[]>(Prisma.sql`${query}
        SELECT kind, category, COUNT(*) AS count, SUM("readerReadSeconds")::bigint AS "readSeconds"
        FROM readers GROUP BY kind, category`),
      tx.$queryRaw<ReaderRow[]>(Prisma.sql`${query}, lists AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY kind ORDER BY "lastSeenAt" DESC, id DESC) AS "listRank" FROM readers
      ) SELECT l.id, l."visitorId", l."ipHash", l."deviceModel", l."devicePlatform", l."deviceArchitecture",
          l."deviceType", l.os, l.browser, l.country, l.region, l.city, l.kind, l.category,
          l."readerReadSeconds", l."readerFirstSeenAt", l."lastSeenAt", u.name AS "readerName"
        FROM lists l LEFT JOIN "User" u ON u.id = l."userId" AND l.kind = 'Logged in'
        WHERE l."listRank" <= ${RECENT_READERS_PER_KIND}
        ORDER BY l."lastSeenAt" DESC, l.id DESC`),
    ]);
    const counts = { "Logged in": 0, Guest: 0, Legacy: 0 };
    const seconds = { "Logged in": 0, Guest: 0, Legacy: 0 };
    const devices: Record<DeviceCategory, number> = { Android: 0, iPhone: 0, "PC / Laptop": 0, Other: 0 };
    for (const group of groups) {
      counts[group.kind] += Number(group.count);
      seconds[group.kind] += Number(group.readSeconds);
      devices[group.category] += Number(group.count);
    }
    // Allowlist DTO: none of the internal grouping keys, IDs, UA, email or OAuth
    // data are returned. User.name is fetched in one join, never one query/reader.
    const viewers = recent.map(view => ({
      displayName: view.kind === "Logged in" ? normalizeText(view.readerName) || "Qasas user" : null,
      visitorLabel: visitorLabel(view), deviceModel: deviceLabel(view),
      deviceCategory: view.category, deviceType: view.deviceType,
      architecture: view.deviceArchitecture, os: view.os, browser: view.browser,
      approximateLocation: approximateLocation(view), visitorKind: view.kind,
      totalReadSeconds: Number(view.readerReadSeconds),
      firstSeenAt: view.readerFirstSeenAt.toISOString(), lastSeenAt: view.lastSeenAt.toISOString(),
    }));
    return {
      uniqueViewsCount: counts["Logged in"] + counts.Guest + counts.Legacy,
      totalReadSeconds: seconds["Logged in"] + seconds.Guest + seconds.Legacy,
      loggedIn: counts["Logged in"], guests: counts.Guest, legacy: counts.Legacy,
      loggedInReadSeconds: seconds["Logged in"], guestReadSeconds: seconds.Guest, legacyReadSeconds: seconds.Legacy,
      devices, recentLimitPerKind: RECENT_READERS_PER_KIND, viewers,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 2000, timeout: 8000 });
}

export type InsightViewer = Awaited<ReturnType<typeof getStoryInsights>>["viewers"][number];
