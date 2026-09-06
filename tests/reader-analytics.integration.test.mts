import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/qasas_test") throw new Error("Dedicated localhost qasas_test database required.");
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.ANALYTICS_SALT = "test-only-analytics-salt-with-at-least-32-characters";
const { prisma } = await import("../src/lib/prisma");
const { getStoryInsights, StoryInsightsDenied } = await import("../src/lib/story-insights");
const { recordStoryActivity, trackingMetadata } = await import("../src/lib/tracking");
const emails: string[] = [];
async function user(name: string | null = "Reader fixture") {
  const email = `reader-${randomUUID()}@example.invalid`; emails.push(email);
  return prisma.user.create({ data: { email, name } });
}
async function fixture() {
  const owner = await user("Owner fixture");
  const story = await prisma.story.create({ data: { authorId: owner.id, title: "Reader analytics fixture", content: "Local test story only." } });
  return { owner, story };
}
const identity = () => ({ visitorId: randomUUID(), ipHash: null });
const metadata = trackingMetadata(new Headers({ "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", "x-vercel-ip-city": "Kushtia", "x-vercel-ip-country-region": "D", "x-vercel-ip-country": "BD" }), {}, false);
after(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await prisma.story.deleteMany({ where: { authorId: { in: users.map(value => value.id) } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

test("new anonymous views are Guest even if metadata claims authentication; refreshes reuse one stream", async () => {
  const { owner, story } = await fixture(); const browser = identity();
  await Promise.all(Array.from({ length: 10 }, () => recordStoryActivity(story.id, browser, { ...metadata, isAuthenticated: true }, { userId: null })));
  const rows = await prisma.storyView.findMany({ where: { storyId: story.id } });
  assert.equal(rows.length, 1); assert.equal(rows[0].userId, null); assert.equal(rows[0].isAuthenticated, false);
  const insights = await getStoryInsights(story.id, owner.id);
  assert.equal(insights.guests, 1); assert.equal(insights.loggedIn, 0); assert.equal(insights.legacy, 0);
  assert.equal(insights.viewers[0].displayName, null); assert.equal(insights.viewers[0].visitorKind, "Guest");
});

test("signed-in streams deduplicate across browsers, join current User.name and never expose sensitive fields", async () => {
  const { owner, story } = await fixture(); const reader = await user(); const browsers = [identity(), identity()];
  for (const browser of browsers) await Promise.all(Array.from({ length: 5 }, () => recordStoryActivity(story.id, browser, metadata, { userId: reader.id, deviceArchitecture: "x86" }, 15)));
  const rows = await prisma.storyView.findMany({ where: { storyId: story.id } });
  assert.equal(rows.length, 2);
  for (const row of rows) { assert.equal(row.userId, reader.id); assert.equal(row.isAuthenticated, true); assert.equal(row.totalReadSeconds, 15); }
  await prisma.user.update({ where: { id: reader.id }, data: { name: "Current database name" } });
  const insights = await getStoryInsights(story.id, owner.id);
  assert.equal(insights.uniqueViewsCount, 1); assert.equal(insights.loggedIn, 1); assert.equal(insights.guests, 0);
  assert.equal(insights.totalReadSeconds, 30); assert.equal(insights.viewers[0].totalReadSeconds, 30);
  assert.equal(insights.devices["PC / Laptop"], 1); assert.equal(insights.viewers[0].displayName, "Current database name");
  assert.equal(insights.viewers[0].architecture, "x86");
  const serialized = JSON.stringify(insights);
  for (const value of [reader.email, reader.id, owner.id, story.id, ...browsers.map(value => value.visitorId), metadata.userAgent!]) assert.equal(serialized.includes(value), false);
  for (const key of ["id", "userId", "visitorId", "ipHash", "userAgent", "email", "access_token", "providerAccountId", "readerKey"]) assert.equal(Object.hasOwn(insights.viewers[0], key), false);
  await prisma.user.update({ where: { id: reader.id }, data: { name: "  " } });
  assert.equal((await getStoryInsights(story.id, owner.id)).viewers[0].displayName, "Qasas user");
});

test("login, logout and account changes update the existing browser stream without duplicate unique viewers", async () => {
  const { owner, story } = await fixture(); const first = await user("First reader"); const second = await user("Second reader"); const browser = identity();
  await recordStoryActivity(story.id, browser, metadata, { userId: null }, 18);
  const original = await prisma.storyView.findFirstOrThrow({ where: { storyId: story.id } });
  for (const current of [first, second, null, second]) {
    await recordStoryActivity(story.id, browser, metadata, { userId: current?.id || null });
    const row = await prisma.storyView.findFirstOrThrow({ where: { storyId: story.id } });
    assert.equal(row.id, original.id); assert.equal(row.totalReadSeconds, 18);
    assert.equal(row.userId, current?.id || null); assert.equal(row.isAuthenticated, Boolean(current));
    const insights = await getStoryInsights(story.id, owner.id);
    assert.equal(insights.uniqueViewsCount, 1); assert.equal(insights.legacy, 0); assert.equal(insights.totalReadSeconds, 18);
    assert.equal(insights.viewers[0].displayName, current?.name || null);
  }
});

test("read-time gate survives guest-to-user promotion and repeated concurrent updates", async () => {
  const { owner, story } = await fixture(); const browser = identity();
  await recordStoryActivity(story.id, browser, metadata, { userId: null }, 18);
  await Promise.all(Array.from({ length: 10 }, () => recordStoryActivity(story.id, browser, metadata, { userId: owner.id }, 18)));
  assert.equal((await getStoryInsights(story.id, owner.id)).totalReadSeconds, 18);
  await prisma.storyView.updateMany({ where: { storyId: story.id }, data: { lastReadAt: new Date(Date.now() - 20000) } });
  await Promise.all(Array.from({ length: 5 }, () => recordStoryActivity(story.id, browser, metadata, { userId: owner.id }, 15)));
  assert.equal((await getStoryInsights(story.id, owner.id)).totalReadSeconds, 33);
  const updated = await prisma.story.findUniqueOrThrow({ where: { id: story.id } });
  assert.equal(updated.totalReadSeconds, 33); assert.equal(updated.updatedAt.getTime(), story.updatedAt.getTime());
});

test("owner authorization is enforced inside the Insights service, including deleted stories", async () => {
  const { owner, story } = await fixture(); const stranger = await user();
  await recordStoryActivity(story.id, identity(), metadata, { userId: stranger.id });
  for (const actor of ["", stranger.id]) await assert.rejects(getStoryInsights(story.id, actor), StoryInsightsDenied);
  assert.equal((await getStoryInsights(story.id, owner.id)).loggedIn, 1);
  await prisma.story.update({ where: { id: story.id }, data: { deletedAt: new Date() } });
  await assert.rejects(getStoryInsights(story.id, owner.id), StoryInsightsDenied);
});

test("device counts classify unique readers truthfully and preserve exact model details", async () => {
  const { owner, story } = await fixture();
  const cases = [
    ["Android", "mobile", "SM-A546E", "Android"], ["Android", "tablet", "Pixel Tablet", "Android"],
    ["iOS", "mobile", "iPhone", "iPhone"], ["iOS", "mobile", "iPhone 15 Pro", "iPhone"], ["iOS", "tablet", "iPad", "Other"],
    ["Linux", "desktop", "Acer Predator PHN16-71", "PC / Laptop"], ["Windows", "desktop", "Dell XPS 15 9530", "PC / Laptop"],
    ["macOS", "desktop", "MacBook", "PC / Laptop"], ["ChromeOS", "desktop", null, "PC / Laptop"],
    [null, null, null, "Other"], ["Android", "smarttv", null, "Other"],
  ] as const;
  for (const [platform, type, model] of cases) await recordStoryActivity(story.id, identity(), { ...metadata, devicePlatform: platform, os: platform, deviceType: type, deviceModel: model || undefined }, { userId: null });
  const insights = await getStoryInsights(story.id, owner.id);
  assert.deepEqual(insights.devices, { Android: 2, iPhone: 2, "PC / Laptop": 4, Other: 3 });
  for (const [, , model, category] of cases) if (model) {
    const reader = insights.viewers.find(view => view.deviceModel === model)!;
    assert.ok(reader); assert.equal(reader.deviceCategory, category);
  }
  assert.ok(insights.viewers.some(view => view.deviceModel === "Unknown device"));
});

test("missing or generic subsequent hints cannot downgrade a known exact device model", async () => {
  const { owner, story } = await fixture(); const browser = identity();
  await recordStoryActivity(story.id, browser, { ...metadata, deviceModel: "iPhone 15 Pro" }, { userId: null });
  for (const model of [undefined, "iPhone", "K", "Unknown device", "Generic device"]) await recordStoryActivity(story.id, browser, { ...metadata, deviceModel: model }, { userId: null });
  assert.equal((await getStoryInsights(story.id, owner.id)).viewers[0].deviceModel, "iPhone 15 Pro");
});

test("legacy NULL rows remain intact without fabricated identities or classifications", async () => {
  const { owner, story } = await fixture();
  await prisma.storyView.createMany({ data: [null, true, false].map(isAuthenticated => ({ storyId: story.id, visitorId: randomUUID(), isAuthenticated, totalReadSeconds: 7 })) });
  const insights = await getStoryInsights(story.id, owner.id);
  assert.equal(insights.uniqueViewsCount, 3); assert.equal(insights.legacy, 2); assert.equal(insights.guests, 1); assert.equal(insights.loggedIn, 0);
  assert.equal(insights.totalReadSeconds, 21);
  assert.ok(insights.viewers.every(view => view.displayName === null));
  assert.equal(await prisma.storyView.count({ where: { storyId: story.id, userId: null } }), 3);
});

test("summary counts cover over a thousand streams while each reader list is bounded", async () => {
  const { owner, story } = await fixture(); const readers = await Promise.all(Array.from({ length: 25 }, () => user()));
  await prisma.storyView.createMany({ data: [
    ...Array.from({ length: 1000 }, () => ({ storyId: story.id, visitorId: randomUUID(), isAuthenticated: false, totalReadSeconds: 1, devicePlatform: "Android", deviceType: "mobile" })),
    ...readers.flatMap(reader => [0, 1].map(() => ({ storyId: story.id, visitorId: randomUUID(), userId: reader.id, isAuthenticated: true, totalReadSeconds: 2, devicePlatform: "Linux", deviceType: "desktop" }))),
  ] });
  const insights = await getStoryInsights(story.id, owner.id);
  assert.equal(insights.uniqueViewsCount, 1025); assert.equal(insights.loggedIn, 25); assert.equal(insights.guests, 1000);
  assert.equal(insights.totalReadSeconds, 1100); assert.equal(insights.viewers.length, 40);
  assert.deepEqual(insights.devices, { Android: 1000, iPhone: 0, "PC / Laptop": 25, Other: 0 });
  assert.equal(insights.viewers.filter(view => view.visitorKind === "Logged in").length, 20);
  assert.equal(insights.viewers.filter(view => view.visitorKind === "Guest").length, 20);
});
