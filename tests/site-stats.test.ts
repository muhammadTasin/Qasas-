import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_STATS_INTERVAL_MS, siteStatsBucket } from "../src/lib/site-stats-policy";

test("cache buckets cannot reuse earlier aggregate results beyond the display freshness budget", () => {
  assert.ok(SITE_STATS_INTERVAL_MS * 2 <= 60_000);
  const now = 1_800_000_000_123;
  assert.equal(siteStatsBucket(now), siteStatsBucket(now + 100));
  assert.notEqual(siteStatsBucket(now), siteStatsBucket(now + SITE_STATS_INTERVAL_MS));
  assert.notEqual(siteStatsBucket(now), siteStatsBucket(now + 60_000));
});
