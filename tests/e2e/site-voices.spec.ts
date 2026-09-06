import { test, expect, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/qasas_test") throw new Error("Dedicated localhost qasas_test database required.");
if (!process.env.NEXTAUTH_SECRET) throw new Error("Use the local server's test NEXTAUTH_SECRET.");
const db = new PrismaClient({ datasources: { db: { url } } });
const baseURL = "http://localhost:3000";
const sessionName = "next-auth.session-token";
const users: string[] = [];
const visitors: string[] = [];
const count = async () => await db.user.count({ where: { siteLastSeenAt: { not: null } } }) + await db.siteVisitor.count({ where: { userId: null } });
async function user() {
  const row = await db.user.create({ data: { email: `voices-${randomUUID()}@example.invalid`, name: "Private voices fixture" } });
  users.push(row.id); return row;
}
async function setVisitor(context: BrowserContext) {
  const id = randomUUID(); visitors.push(id);
  await context.addCookies([{ name: "visitorId", value: id, url: baseURL }]);
  return id;
}
async function signIn(context: BrowserContext, id: string) {
  // Real encrypted NextAuth session decoded by the running server. Provider
  // credential/callback exchange remains covered by the existing auth suite.
  const token = await encode({ token: { sub: id }, secret: process.env.NEXTAUTH_SECRET!, maxAge: 3600 });
  await context.addCookies([{ name: sessionName, value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}
async function visit(context: BrowserContext, extra: Record<string, unknown> = {}) {
  expect((await context.request.post(`${baseURL}/api/site/visit`, { data: { pathname: "/", ...extra } })).status()).toBe(204);
}
test.afterAll(async () => {
  const { anonymousSuffix } = await import("../../src/lib/analytics");
  await db.siteVisitEvent.deleteMany({ where: { visitorId: { in: visitors.map(visitorId => anonymousSuffix({ visitorId, ipHash: null })) } } });
  await db.siteVisitor.deleteMany({ where: { visitorId: { in: visitors } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("site API trusts server auth across devices, rapid transitions and spoofed bodies; stats are aggregate-only", async ({ browser }) => {
  test.setTimeout(120_000);
  const a = await user(); const b = await user();
  const initial = await count();
  const desktop = await browser.newContext();
  const phone = await browser.newContext({ userAgent: "Mozilla/5.0 (Linux; Android 13; RMX3834) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" });
  const iphone = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1" });
  const guest = await browser.newContext();
  try {
    const desktopId = await setVisitor(desktop);
    const phoneId = await setVisitor(phone);
    await setVisitor(iphone); const guestId = await setVisitor(guest);
    await signIn(desktop, a.id);
    await visit(desktop, { userId: b.id, email: b.email, isAuthenticated: false });
    expect(await count()).toBe(initial + 1);
    expect((await db.siteVisitor.findUniqueOrThrow({ where: { visitorId: desktopId } })).userId).toBe(a.id);
    await visit(phone); expect(await count()).toBe(initial + 2);
    await signIn(phone, a.id); await visit(phone);
    expect(await count()).toBe(initial + 1);
    expect((await db.siteVisitor.findUniqueOrThrow({ where: { visitorId: phoneId } })).userId).toBe(a.id);
    await signIn(iphone, a.id); await visit(iphone);
    expect(await count()).toBe(initial + 1);

    await desktop.clearCookies({ name: sessionName }); await visit(desktop);
    expect(await count()).toBe(initial + 1);
    const loggedOut = await db.siteVisitor.findUniqueOrThrow({ where: { visitorId: desktopId } });
    expect(loggedOut.userId).toBe(a.id); expect(loggedOut.isAuthenticated).toBe(false);
    await signIn(desktop, b.id); await visit(desktop);
    await signIn(desktop, a.id); await visit(desktop);
    expect(await count()).toBe(initial + 2);
    expect((await db.siteVisitor.findUniqueOrThrow({ where: { visitorId: desktopId } })).userId).toBe(a.id);
    await desktop.clearCookies(); await setVisitor(desktop);
    await signIn(desktop, a.id); await visit(desktop);
    expect(await count()).toBe(initial + 2);

    await visit(guest, { userId: a.id, email: a.email, isAuthenticated: true });
    expect(await count()).toBe(initial + 3);
    const guestRow = await db.siteVisitor.findUniqueOrThrow({ where: { visitorId: guestId } });
    expect(guestRow.userId).toBeNull(); expect(guestRow.isAuthenticated).toBe(false);
    expect((await guest.request.get(`${baseURL}/api/site/stats`)).status()).toBe(401);
    for (let i = 0; i < 5; i++) await visit(guest, { pathname: i % 2 ? "/about" : "/" });
    expect(await count()).toBe(initial + 3);
    await expect.poll(async () => (await (await desktop.request.get(`${baseURL}/api/site/stats`)).json()).uniqueVisitorsLifetime, { timeout: 35_000, intervals: [1000] }).toBe(initial + 3);
    const response = await desktop.request.get(`${baseURL}/api/site/stats`);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const stats = await response.json();
    expect(Object.keys(stats).sort()).toEqual(["totalVisits", "uniqueVisitorsLast30Days", "uniqueVisitorsLifetime"]);
    expect(Object.values(stats).every(value => typeof value === "number")).toBe(true);
    for (const privateValue of [a.id, a.email, a.name!, b.id, desktopId, phoneId, guestId]) expect(JSON.stringify(stats)).not.toContain(privateValue);
    expect(stats.totalVisits).toBeGreaterThan(3);
  } finally { await Promise.all([desktop.close(), phone.close(), iphone.close(), guest.close()]); }
});

test("an already open footer reflects cross-device reconciliation within 60 seconds", async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await user();
  const desktop = await browser.newContext(); const phone = await browser.newContext();
  try {
    await setVisitor(desktop); await signIn(desktop, a.id); await visit(desktop);
    await setVisitor(phone); await visit(phone);
    const inflated = await count();
    await expect.poll(async () => (await (await desktop.request.get(`${baseURL}/api/site/stats`)).json()).uniqueVisitorsLifetime, { timeout: 35_000, intervals: [1000] }).toBe(inflated);
    const page = await desktop.newPage();
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(baseURL);
    await expect(page.getByText(`${new Intl.NumberFormat("en-US").format(inflated)} Unique Voices`, { exact: true })).toBeVisible();
    await signIn(phone, a.id); await visit(phone);
    expect(await count()).toBe(inflated - 1);
    // No reload, navigation, cache bypass or mocked server clock. This exercises
    // the real production Next cache and the mounted widget's real interval.
    const started = Date.now();
    await expect(page.getByText(`${new Intl.NumberFormat("en-US").format(inflated - 1)} Unique Voices`, { exact: true })).toBeVisible({ timeout: 60_000 });
    expect(Date.now() - started).toBeLessThan(60_000);
    expect(errors).toEqual([]);
    await page.screenshot({ path: "/tmp/qasas-voices-footer.png", fullPage: true });
    await desktop.clearCookies({ name: sessionName });
    await page.reload();
    await expect(page.getByText(/Unique Voices/i)).toHaveCount(0);
  } finally { await Promise.all([desktop.close(), phone.close()]); }
});
