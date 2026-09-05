"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { getClientHints, recentlyTracked, sendAnalytics } from "@/lib/analytics-client";

export default function SiteVisitTracker() {
  const pathname = usePathname();
  const { status } = useSession();
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    void getClientHints().then(hints => {
      if (cancelled || recentlyTracked(`site:${pathname}:${status}`)) return;
      sendAnalytics("/api/site/visit", { pathname, hints });
    });
    return () => { cancelled = true; };
  }, [pathname, status]);
  return null;
}
