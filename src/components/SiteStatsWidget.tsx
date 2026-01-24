import { prisma } from "@/lib/prisma";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function SiteStatsWidget() {
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [uniqueLifetime, uniqueLast30, totalVisits] = await Promise.all([
    prisma.siteVisitor.count(),
    prisma.siteVisitor.count({ where: { lastSeenAt: { gte: last30 } } }),
    prisma.siteVisitEvent.count(),
  ]);

  return (
    <div className="glass rounded-3xl px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="badge bg-white/70">
          Unique visitors to Qasas: {formatNumber(uniqueLifetime)}
        </span>
        <span className="badge bg-white/60">Last 30 days: {formatNumber(uniqueLast30)}</span>
        <span className="badge bg-white/50">Total visits: {formatNumber(totalVisits)}</span>
      </div>
    </div>
  );
}
