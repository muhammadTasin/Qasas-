"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { getClientHints, getPreciseCoords, sendAnalytics } from "@/lib/analytics-client";

export default function SiteVisitTracker() {
  const pathname = usePathname();
  const { status, data: session } = useSession();
  const accountId = session?.user?.id;
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    void Promise.all([getClientHints(), getPreciseCoords()]).then(([hints, coords]) => {
      // Let PostgreSQL coalesce events; a rapid A -> guest -> A transition
      // must still reconcile identity even inside the previous client's gate.
      if (cancelled) return;
      sendAnalytics("/api/site/visit", { pathname, hints, ...(coords ? { coords } : {}) });
    });
    return () => { cancelled = true; };
  }, [pathname, status, accountId]);
  return null;
}
