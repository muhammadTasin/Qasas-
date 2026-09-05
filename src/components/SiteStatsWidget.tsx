"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Stats = { uniqueVisitorsLifetime: number; uniqueVisitorsLast30Days: number; totalVisits: number };
const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export default function SiteStatsWidget() {
  const { status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    fetch("/api/site/stats", { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<Stats> : null)
      .then(value => { if (!controller.signal.aborted) setStats(value); })
      .catch(() => {});
    return () => controller.abort();
  }, [status]);
  if (status !== "authenticated" || !stats) return null;
  return (
    <div className="glass rounded-3xl px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="badge bg-white/70">Unique visitors to Qasas: {formatNumber(stats.uniqueVisitorsLifetime)}</span>
        <span className="badge bg-white/60">Last 30 days: {formatNumber(stats.uniqueVisitorsLast30Days)}</span>
        <span className="badge bg-white/50">Total visits: {formatNumber(stats.totalVisits)}</span>
      </div>
    </div>
  );
}
