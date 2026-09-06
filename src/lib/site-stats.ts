import { unstable_cache } from "next/cache";
import { querySiteStats } from "./site-stats-query";
import { SITE_STATS_INTERVAL_MS, siteStatsBucket } from "./site-stats-policy";

const cachedSiteStats = unstable_cache(async (bucket: number) => {
  // Arguments are part of Next's cache key. A new bucket cannot serve a stale
  // prior-bucket result while background revalidation runs.
  void bucket;
  return querySiteStats();
}, ["private-site-stats-people-v2"], { revalidate: SITE_STATS_INTERVAL_MS / 1000 });

export function getSiteStats() { return cachedSiteStats(siteStatsBucket()); }
