"use client";
import { Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { SITE_STATS_INTERVAL_MS } from "@/lib/site-stats-policy";
type Stats = { uniqueVisitorsLifetime: number; uniqueVisitorsLast30Days: number; totalVisits: number };
export default function SiteStatsWidget() {
  const { status, data: session } = useSession();
  // Unmount cached private data on logout or account change.
  if (status !== "authenticated" || !session?.user?.id) return null;
  return <AuthenticatedSiteStats key={session.user.id} />;
}

function AuthenticatedSiteStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = () => {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      void fetch("/api/site/stats", { signal: controller.signal, cache: "no-store" })
        .then(response => response.ok ? response.json() as Promise<Stats> : null)
        .then(value => { if (!controller.signal.aborted) setStats(value); })
        .catch(() => { if (!controller.signal.aborted) setStats(null); })
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
  }, []);
  if (!stats) return null;
  return <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
    <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-[10px] font-bold text-emerald-800 uppercase tracking-widest">
      <Globe size={10} aria-hidden="true" /><span>{new Intl.NumberFormat("en-US").format(stats.totalVisits)} Total Views</span>
    </div>
    <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-[10px] font-bold text-emerald-800 uppercase tracking-widest">
      <Globe size={10} /><span>{new Intl.NumberFormat("en-US").format(stats.uniqueVisitorsLifetime)} Unique Voices</span>
    </div>
  </div>;
}
