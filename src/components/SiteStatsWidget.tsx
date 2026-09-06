"use client";
import { Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { SITE_STATS_INTERVAL_MS } from "@/lib/site-stats-policy";
type Stats = { uniqueVisitorsLifetime: number; uniqueVisitorsLast30Days: number; totalVisits: number };
export default function SiteStatsWidget() {
  const { status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    let pending = false;
    const refresh = () => {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      void fetch("/api/site/stats", { signal: controller.signal, cache: "no-store" })
        .then(response => response.ok ? response.json() as Promise<Stats> : null)
        .then(value => { if (!controller.signal.aborted) setStats(value); })
        .catch(() => {})
        .finally(() => { pending = false; });
    };
    refresh();
    const timer = window.setInterval(refresh, SITE_STATS_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [status]);
  if (status !== "authenticated" || !stats) return null;
  return <div className="flex items-center justify-center gap-2 mb-6">
    <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-[10px] font-bold text-emerald-800 uppercase tracking-widest">
      <Globe size={10} /><span>{new Intl.NumberFormat("en-US").format(stats.uniqueVisitorsLifetime)} Unique Voices</span>
    </div>
  </div>;
}
