import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export const getSiteStats = unstable_cache(async () => {
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [uniqueVisitorsLifetime, uniqueVisitorsLast30Days, totalVisits] = await Promise.all([
    prisma.siteVisitor.count(),
    prisma.siteVisitor.count({ where: { lastSeenAt: { gte: last30 } } }),
    prisma.siteVisitEvent.count(),
  ]);
  return { uniqueVisitorsLifetime, uniqueVisitorsLast30Days, totalVisits };
}, ["private-site-stats-v1"], { revalidate: 60 });
