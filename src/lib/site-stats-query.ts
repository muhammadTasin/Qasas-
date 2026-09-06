import { prisma } from "./prisma";

export async function querySiteStats() {
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // A single statement observes the account marker and browser reconciliation
  // in the same PostgreSQL snapshot, even during concurrent login transactions.
  // User's primary key is already unique; no device rows leave the database.
  const [counts] = await prisma.$queryRaw<{
    uniqueVisitorsLifetime: bigint; uniqueVisitorsLast30Days: bigint; totalVisits: bigint;
  }[]>`
    SELECT
      (SELECT COUNT(*) FROM "User" WHERE "siteLastSeenAt" IS NOT NULL) +
      (SELECT COUNT(*) FROM "SiteVisitor" WHERE "userId" IS NULL) AS "uniqueVisitorsLifetime",
      (SELECT COUNT(DISTINCT "userId") FROM (
        SELECT "id" AS "userId" FROM "User" WHERE "siteLastSeenAt" >= ${last30.toISOString()}::timestamp(3)
        UNION ALL
        SELECT "userId" FROM "SiteVisitor" WHERE "userId" IS NOT NULL AND "lastSeenAt" >= ${last30.toISOString()}::timestamp(3)
      ) recent_accounts) +
      (SELECT COUNT(*) FROM "SiteVisitor" WHERE "userId" IS NULL AND "lastSeenAt" >= ${last30.toISOString()}::timestamp(3)) AS "uniqueVisitorsLast30Days",
      (SELECT COUNT(*) FROM "SiteVisitEvent") AS "totalVisits"
  `;
  return {
    uniqueVisitorsLifetime: Number(counts.uniqueVisitorsLifetime),
    uniqueVisitorsLast30Days: Number(counts.uniqueVisitorsLast30Days),
    totalVisits: Number(counts.totalVisits),
  };
}
