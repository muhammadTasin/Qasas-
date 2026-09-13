import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { anonymousSuffix, approximateLocation, visitorLabel } from "./analytics";
import { deviceLabel, normalizeText } from "./device-info";

type VisitKind = "New" | "Returning";
type DeviceCategory = "Android" | "iPhone" | "PC / Laptop" | "Other";
type SummaryRow = { kind: VisitKind; category: DeviceCategory; count: bigint };
type VisitorRow = {
  id: string; visitorId: string | null; ipHash: string | null;
  deviceModel: string | null; devicePlatform: string | null;
  deviceType: string | null; os: string | null; browser: string | null;
  country: string | null; region: string | null; city: string | null;
  latitude: number | null; longitude: number | null; locationAccuracyM: number | null;
  kind: VisitKind; category: DeviceCategory; displayName: string | null;
  firstSeenAt: Date; lastSeenAt: Date;
};

const WINDOW_HOURS = 24;
const RECENT_VISITORS_PER_KIND = 20;

// Same device-category heuristic as story-insights.ts's readersQuery, applied
// to SiteVisitor (which has no deviceArchitecture column, so that branch is
// simply absent). A visitor first seen inside the window is New; one already
// seen before but active again inside it is Returning.
function visitorsQuery(windowStart: Date) {
  const since = windowStart.toISOString();
  return Prisma.sql`
    WITH base AS (
      SELECT sv.*,
        CASE WHEN "firstSeenAt" >= ${since}::timestamp(3) THEN 'New' ELSE 'Returning' END AS kind
      FROM "SiteVisitor" sv WHERE "lastSeenAt" >= ${since}::timestamp(3)
    ), visitors AS (
      SELECT *, CASE
        WHEN COALESCE("deviceType", '') NOT IN ('smarttv', 'console', 'wearable', 'embedded')
          AND COALESCE(NULLIF("devicePlatform", ''), os, '') ~* 'android' THEN 'Android'
        WHEN COALESCE("deviceType", '') <> 'tablet' AND COALESCE("deviceModel", '') !~* '^ipad'
          AND (COALESCE(NULLIF("devicePlatform", ''), os, '') ~* 'ios|iphone' OR COALESCE("deviceModel", '') ~* '^iphone') THEN 'iPhone'
        WHEN COALESCE("deviceType", 'desktop') = 'desktop'
          AND COALESCE(NULLIF("devicePlatform", ''), os, '') ~* 'linux|windows|mac|chrome|chromium|cros' THEN 'PC / Laptop'
        ELSE 'Other' END AS category
      FROM base
    )`;
}

export async function getSiteInsights() {
  const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
  return prisma.$transaction(async tx => {
    const query = visitorsQuery(windowStart);
    const [groups, recent, totalVisits] = await Promise.all([
      tx.$queryRaw<SummaryRow[]>(Prisma.sql`${query}
        SELECT kind, category, COUNT(*) AS count FROM visitors GROUP BY kind, category`),
      tx.$queryRaw<VisitorRow[]>(Prisma.sql`${query}, lists AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY kind ORDER BY "lastSeenAt" DESC, id DESC) AS "listRank" FROM visitors
      ) SELECT l.id, l."visitorId", l."ipHash", l."deviceModel", l."devicePlatform",
          l."deviceType", l.os, l.browser, l.country, l.region, l.city,
          l.latitude, l.longitude, l."locationAccuracyM", l.kind, l.category,
          l."firstSeenAt", l."lastSeenAt", u.name AS "displayName"
        FROM lists l LEFT JOIN "User" u ON u.id = l."userId" AND l."isAuthenticated" IS TRUE
        WHERE l."listRank" <= ${RECENT_VISITORS_PER_KIND}
        ORDER BY l."lastSeenAt" DESC, l.id DESC`),
      tx.siteVisitEvent.count({ where: { createdAt: { gte: windowStart } } }),
    ]);

    const devices: Record<DeviceCategory, number> = { Android: 0, iPhone: 0, "PC / Laptop": 0, Other: 0 };
    let newDevices = 0;
    let returningDevices = 0;
    for (const group of groups) {
      const count = Number(group.count);
      if (group.kind === "New") newDevices += count; else returningDevices += count;
      devices[group.category] += count;
    }

    // Reproduces the same label SiteVisitEvent.visitorId was written with in
    // recordSiteVisit (anonymousSuffix applied to the same identity fields),
    // so per-visitor visit counts can be looked up without a foreign key.
    const labeled = recent.map(row => ({ row, label: anonymousSuffix(row) }));
    const labels = labeled.map(entry => entry.label);
    const eventCounts = labels.length
      ? await tx.siteVisitEvent.groupBy({
          by: ["visitorId"],
          where: { visitorId: { in: labels }, createdAt: { gte: windowStart } },
          _count: { _all: true },
        })
      : [];
    const visitsByLabel = new Map(eventCounts.map(entry => [entry.visitorId, entry._count._all]));

    // Allowlist DTO: no visitorId, ipHash, userId or email is ever returned.
    const visitors = labeled.map(({ row, label }) => ({
      displayName: normalizeText(row.displayName),
      visitorLabel: visitorLabel(row),
      visitKind: row.kind,
      deviceCategory: row.category,
      deviceModel: deviceLabel(row),
      deviceType: row.deviceType,
      os: row.os,
      browser: row.browser,
      approximateLocation: approximateLocation(row),
      preciseLocation: row.latitude != null && row.longitude != null
        ? { latitude: row.latitude, longitude: row.longitude, accuracyMeters: row.locationAccuracyM }
        : null,
      visitsInWindow: visitsByLabel.get(label) ?? 0,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));

    return {
      windowHours: WINDOW_HOURS,
      uniqueDevicesCount: newDevices + returningDevices,
      newDevices, returningDevices, totalVisits,
      devices, recentLimitPerKind: RECENT_VISITORS_PER_KIND, visitors,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 2000, timeout: 8000 });
}

export type SiteInsights = Awaited<ReturnType<typeof getSiteInsights>>;
export type SiteInsightVisitor = SiteInsights["visitors"][number];
