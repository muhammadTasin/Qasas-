import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const connection = process.env.TEST_DATABASE_URL;
if (!connection || !["localhost", "127.0.0.1"].includes(new URL(connection).hostname) || new URL(connection).pathname !== "/qasas_test") throw new Error("Dedicated localhost qasas_test database required.");
// Global counts require isolation from the other concurrently running suites.
const url = new URL(connection);
const database = `qasas_voices_${randomUUID().replaceAll("-", "")}`;
const pgEnv = { ...process.env, PGHOST: url.searchParams.get("host") || url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: "postgres" };
const sql = (statement: string) => execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", statement], { env: pgEnv, encoding: "utf8" });
url.pathname = `/${database}`;
process.env.DATABASE_URL = url.toString();
process.env.DIRECT_URL = url.toString();
process.env.ANALYTICS_SALT = "unique-voices-isolated-test-salt-at-least-32-characters";
const { prisma } = await import("../src/lib/prisma");
const { recordSiteVisit, trackingMetadata } = await import("../src/lib/tracking");
const { querySiteStats } = await import("../src/lib/site-stats-query");
const identity = () => ({ visitorId: randomUUID(), ipHash: null });
const metadata = trackingMetadata(new Headers({ "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0" }), {}, false);
const visit = (browser: ReturnType<typeof identity>, userId: string | null = null, pathname = "/") => recordSiteVisit(browser, { ...metadata, isAuthenticated: Boolean(userId) }, pathname, userId);
const count = async () => (await querySiteStats()).uniqueVisitorsLifetime;
let a: string;
let b: string;
before(async () => {
  sql(`CREATE DATABASE "${database}"`);
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, stdio: "pipe" });
});
beforeEach(async () => {
  await prisma.siteVisitEvent.deleteMany();
  await prisma.siteVisitor.deleteMany();
  await prisma.user.deleteMany();
  a = (await prisma.user.create({ data: { email: "a@example.invalid" } })).id;
  b = (await prisma.user.create({ data: { email: "b@example.invalid" } })).id;
});
after(async () => {
  await prisma.$disconnect();
  sql(`DROP DATABASE IF EXISTS "${database}"`);
});

test("same authenticated account on one, two and three browsers is one voice", async () => {
  const first = identity();
  await visit(first, a); await visit(first, a);
  assert.equal(await count(), 1);
  await visit(identity(), a);
  assert.equal(await count(), 1);
  await visit(identity(), a);
  assert.equal(await count(), 1);
});

test("two authenticated accounts across multiple devices are two voices", async () => {
  for (const userId of [a, b, a, b, a]) await visit(identity(), userId);
  assert.equal(await count(), 2);
});

test("guest refresh and navigation reuse the anonymous identity", async () => {
  const guest = identity();
  for (let i = 0; i < 50; i++) await visit(guest, null, i % 2 ? "/about" : "/");
  assert.equal(await count(), 1);
  await visit(identity()); assert.equal(await count(), 2);
});

test("guest logging into a newly seen account stays one voice", async () => {
  const guest = identity();
  await visit(guest); assert.equal(await count(), 1);
  const [, ...observed] = await Promise.all([visit(guest, a), ...Array.from({ length: 10 }, count)]);
  assert.ok(observed.every(value => value === 1));
  assert.equal(await count(), 1);
});

test("guest logging into an already counted account collapses the duplicate", async () => {
  await visit(identity(), a);
  const phone = identity();
  await visit(phone); assert.equal(await count(), 2);
  await visit(phone, a); assert.equal(await count(), 1);
});

test("login logout login stays one voice", async () => {
  const browser = identity();
  for (const userId of [a, null, a, null, a]) {
    await visit(browser, userId); assert.equal(await count(), 1);
  }
});

test("PC, Android and iPhone on changing IPs and cleared cookies share one account", async () => {
  const { getVisitorIdentity } = await import("../src/lib/analytics");
  const uas = [
    "Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0",
    "Mozilla/5.0 (Linux; Android 13; RMX3834) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  ];
  for (const [i, ua] of uas.entries()) {
    for (const withCookie of [true, false]) {
      const headers = new Headers({ "user-agent": ua, "x-forwarded-for": `192.0.2.${i + 1}` });
      if (withCookie) headers.set("cookie", `visitorId=${randomUUID()}`);
      await recordSiteVisit(getVisitorIdentity(headers), trackingMetadata(headers, {}, true), "/", a);
      assert.equal(await count(), 1);
    }
  }
  await visit(identity(), a); assert.equal(await count(), 1); // Cleared cookies.
  await visit(identity()); assert.equal(await count(), 2); // Unrelated guest.
});

test("salted fallback repeats deduplicate without merging unrelated cookie guests", async () => {
  const { getVisitorIdentity } = await import("../src/lib/analytics");
  const headers = new Headers({ "x-forwarded-for": "192.0.2.10", "user-agent": "guest-test" });
  const fallback = getVisitorIdentity(headers);
  assert.ok(fallback.ipHash); assert.equal(fallback.visitorId, null);
  for (let i = 0; i < 5; i++) await recordSiteVisit(fallback, metadata, "/", null);
  assert.equal(await count(), 1);
  for (let i = 0; i < 2; i++) {
    headers.set("cookie", `visitorId=${randomUUID()}`);
    await recordSiteVisit(getVisitorIdentity(headers), metadata, "/", null);
  }
  assert.equal(await count(), 3);
});

test("shared-browser account switching retains both people and latest reliable link", async () => {
  const browser = identity();
  await visit(browser, a); await visit(browser, b);
  assert.equal(await count(), 2);
  await visit(browser); await visit(browser, a);
  assert.equal(await count(), 2);
  assert.equal((await prisma.siteVisitor.findUniqueOrThrow({ where: { visitorId: browser.visitorId } })).userId, a);
  await visit(identity(), b); assert.equal(await count(), 2);
});

test("logout retains only counting association, never account activity or event identity", async () => {
  const browser = identity();
  const original = await prisma.user.findUniqueOrThrow({ where: { id: a } });
  await visit(browser, a);
  assert.ok(Math.abs((await prisma.user.findUniqueOrThrow({ where: { id: a } })).siteLastSeenAt!.getTime() - Date.now()) < 3000);
  const old = new Date("2020-01-01T00:00:00Z");
  await prisma.$executeRaw`UPDATE "User" SET "siteLastSeenAt" = ${old.toISOString()}::timestamp(3) WHERE id = ${a}`;
  await visit(browser);
  const account = await prisma.user.findUniqueOrThrow({ where: { id: a } });
  assert.equal(account.siteLastSeenAt?.getTime(), old.getTime());
  assert.equal(account.updatedAt.getTime(), original.updatedAt.getTime());
  const row = await prisma.siteVisitor.findUniqueOrThrow({ where: { visitorId: browser.visitorId } });
  assert.equal(row.userId, a); assert.equal(row.isAuthenticated, false);
  const guestEvents = await prisma.siteVisitEvent.findMany({ where: { isAuthenticated: false } });
  assert.equal(guestEvents.length, 1);
  assert.ok(!JSON.stringify(guestEvents).includes(a));
  assert.equal(await count(), 1);
  // Counting can recognize a returning linked browser without changing the
  // account's authenticated activity timestamp or attributing its guest event.
  assert.equal((await querySiteStats()).uniqueVisitorsLast30Days, 1);
});

test("events increase independently and reconciliation never deletes history", async () => {
  const browser = identity();
  await visit(browser);
  for (let i = 0; i < 4; i++) {
    await prisma.siteVisitor.update({ where: { visitorId: browser.visitorId }, data: { lastEventAt: new Date(0) } });
    await visit(browser, null, "/about");
  }
  const before = await prisma.siteVisitEvent.findMany({ orderBy: { id: "asc" } });
  assert.equal(before.length, 5); assert.equal(await count(), 1);
  await visit(browser, a);
  assert.equal(await count(), 1);
  assert.deepEqual(await prisma.siteVisitEvent.findMany({ where: { id: { in: before.map(e => e.id) } }, orderBy: { id: "asc" } }), before);
  assert.equal((await querySiteStats()).totalVisits, 6);
});

test("legacy NULL associations remain anonymous until authenticated re-observation", async () => {
  const browser = identity();
  await prisma.siteVisitor.create({ data: { ...browser, isAuthenticated: true } });
  await prisma.siteVisitor.create({ data: {} });
  assert.equal(await count(), 2);
  await visit(identity(), a); assert.equal(await count(), 3);
  await visit(browser, a); assert.equal(await count(), 2);
  assert.equal(await prisma.siteVisitor.count(), 3);
});

test("same-account concurrent browser visits and reconciliation use atomic database state", async () => {
  const browsers = Array.from({ length: 12 }, identity);
  await Promise.all(browsers.map(browser => visit(browser)));
  assert.equal(await count(), 12);
  await Promise.all(browsers.map(browser => visit(browser, a)));
  assert.equal(await count(), 1);
  assert.equal(await prisma.siteVisitor.count(), 12);
});

test("separate Node processes deduplicate one account without shared memory (Vercel model)", async () => {
  const sameBrowser = identity();
  const run = (browser: ReturnType<typeof identity>) => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "tests/fixtures/site-visit-worker.mts", a, browser.visitorId], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(output)));
  });
  await Promise.all([run(sameBrowser), run(sameBrowser), run(identity()), run(identity())]);
  assert.equal(await count(), 1);
  assert.equal(await prisma.siteVisitor.count(), 3);
  assert.equal(await prisma.siteVisitEvent.count(), 3);
});

test("recent counts deduplicate accounts and guests; unvisited accounts never count", async () => {
  const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  assert.equal(await count(), 0);
  const browser = identity();
  await visit(browser, a);
  await prisma.$executeRaw`UPDATE "User" SET "siteLastSeenAt" = ${old.toISOString()}::timestamp(3) WHERE id = ${a}`;
  await prisma.siteVisitor.update({ where: { visitorId: browser.visitorId }, data: { lastSeenAt: old } });
  await prisma.siteVisitor.create({ data: { ...identity(), lastSeenAt: old } });
  await visit(identity());
  assert.equal((await querySiteStats()).uniqueVisitorsLast30Days, 1);
  await visit(identity(), a);
  const stats = await querySiteStats();
  assert.equal(stats.uniqueVisitorsLifetime, 3); assert.equal(stats.uniqueVisitorsLast30Days, 2);
  assert.deepEqual(Object.keys(stats).sort(), ["totalVisits", "uniqueVisitorsLast30Days", "uniqueVisitorsLifetime"]);
  assert.ok(Object.values(stats).every(value => typeof value === "number"));
});

test("foreign-key account deletion keeps browser/event rows without breaking stats", async () => {
  const browser = identity();
  await visit(browser, a);
  await prisma.user.delete({ where: { id: a } });
  assert.equal((await prisma.siteVisitor.findUniqueOrThrow({ where: { visitorId: browser.visitorId } })).userId, null);
  assert.equal(await count(), 1); assert.equal(await prisma.siteVisitEvent.count(), 1);
});

test("database aggregation covers thousands of streams with a fixed aggregate-only response", async () => {
  await visit(identity(), a); await visit(identity(), b);
  await prisma.siteVisitor.createMany({ data: Array.from({ length: 3000 }, (_, i) => ({ ...identity(), userId: i % 3 === 0 ? null : i % 3 === 1 ? a : b })) });
  const stats = await querySiteStats();
  assert.equal(stats.uniqueVisitorsLifetime, 1002);
  assert.equal(stats.uniqueVisitorsLast30Days, 1002);
  assert.ok(JSON.stringify(stats).length < 120);
});
