// A fresh cache bucket plus one visible-client polling interval is at most 60s.
export const SITE_STATS_INTERVAL_MS = 30_000;
export function siteStatsBucket(now = Date.now()) {
  return Math.floor(now / SITE_STATS_INTERVAL_MS);
}
