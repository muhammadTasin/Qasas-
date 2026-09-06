import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

// Fail closed: this suite creates and cleans fixtures only in a dedicated local DB.
const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/qasas_test") {
  throw new Error("Set TEST_DATABASE_URL to a dedicated localhost database named qasas_test.");
}
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.ANALYTICS_SALT = "test-only-analytics-salt-with-at-least-32-characters";
const { prisma } = await import("../src/lib/prisma");
const { editStory, moveStoryToTrash, publishStory, restoreStory, withActiveStory } = await import("../src/lib/story-mutations");
const { recordSiteVisit, recordStoryActivity, trackingMetadata } = await import("../src/lib/tracking");
const { getStoryInsights } = await import("../src/lib/story-insights");

let owner: string;
let stranger: string;
let storyId: string;
const visitor = { visitorId: randomUUID(), ipHash: null };
const visitor2 = { visitorId: randomUUID(), ipHash: null };
const metadata = trackingMetadata(new Headers({ "user-agent": "Mozilla/5.0 (Linux; Android 13; RMX3834) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" }), { model: "RMX3834", platform: "Android" }, false);

before(async () => {
  owner = (await prisma.user.create({ data: { email: `test-${randomUUID()}@example.invalid`, passwordHash: "fixture-not-a-password", name: "Test author" } })).id;
  stranger = (await prisma.user.create({ data: { email: `test-${randomUUID()}@example.invalid`, passwordHash: "fixture-not-a-password" } })).id;
});
after(async () => {
  await prisma.story.deleteMany({ where: { authorId: { in: [owner, stranger] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, stranger] } } });
  await prisma.siteVisitor.deleteMany({ where: { visitorId: { in: [visitor.visitorId, visitor2.visitorId] } } });
  const { anonymousSuffix } = await import("../src/lib/analytics");
  await prisma.siteVisitEvent.deleteMany({ where: { visitorId: { in: [anonymousSuffix(visitor), anonymousSuffix(visitor2)] } } });
  await prisma.$disconnect();
});

test("publish retries and concurrent submissions create one row", async () => {
  const input = { title: "Integration fixture", content: "This is a test story for the isolated integration database.", submissionId: randomUUID() };
  const ids = await Promise.all(Array.from({ length: 5 }, () => publishStory(owner, input)));
  assert.equal(new Set(ids).size, 1);
  storyId = ids[0];
  assert.equal(await prisma.story.count({ where: { authorId: owner } }), 1);
});

test("refresh and concurrent views deduplicate; login keeps the browser identity", async () => {
  await Promise.all(Array.from({ length: 5 }, () => recordStoryActivity(storyId, visitor, metadata, { userId: null })));
  const before = await prisma.storyView.findFirstOrThrow({ where: { storyId } });
  await recordStoryActivity(storyId, visitor, { ...metadata, isAuthenticated: true }, { userId: owner });
  assert.equal(await prisma.storyView.count({ where: { storyId } }), 1);
  const current = await prisma.storyView.findFirstOrThrow({ where: { storyId } });
  assert.equal(current.id, before.id);
  assert.equal(current.firstSeenAt.getTime(), before.firstSeenAt.getTime());
  assert.ok(current.lastSeenAt >= before.lastSeenAt);
  assert.equal(current.isAuthenticated, true);
  await recordStoryActivity(storyId, visitor2, metadata, { userId: null });
  const insights = await getStoryInsights(storyId, owner);
  assert.equal(insights.uniqueViewsCount, 2);
  assert.equal(insights.loggedIn, 1);
  assert.equal(insights.guests, 1);
  assert.equal(new Set(insights.viewers.map(view => view.visitorLabel)).size, 2);
  for (const view of insights.viewers) {
    assert.match(view.visitorLabel, /^RMX3834_unique_[A-F0-9]{12}$/);
    for (const key of ["id", "visitorId", "ipHash", "userAgent", "authUserId", "email"]) assert.equal(key in view, false);
  }
});

test("database read-time gate rejects concurrent duplicate increments", async () => {
  await Promise.all(Array.from({ length: 5 }, () => recordStoryActivity(storyId, visitor, metadata, { userId: null }, 15)));
  const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
  const view = await prisma.storyView.findUniqueOrThrow({ where: { storyId_visitorId: { storyId, visitorId: visitor.visitorId } } });
  assert.equal(story.totalReadSeconds, 15);
  assert.equal(view.totalReadSeconds, 15);
});

test("route events are coalesced in PostgreSQL and retain guest/login metadata", async () => {
  await Promise.all(Array.from({ length: 5 }, () => recordSiteVisit(visitor, metadata, "/", null)));
  const { anonymousSuffix } = await import("../src/lib/analytics");
  const where = { visitorId: anonymousSuffix(visitor) };
  assert.equal(await prisma.siteVisitEvent.count({ where }), 1);
  // A real authentication transition is retained even inside the event gate.
  await recordSiteVisit(visitor, { ...metadata, isAuthenticated: true }, `/stories/${storyId}`, owner);
  const events = await prisma.siteVisitEvent.findMany({ where, orderBy: { createdAt: "asc" } });
  assert.deepEqual(events.map(event => event.isAuthenticated), [false, true]);
  assert.deepEqual(events.map(event => event.pathname), ["/", `/stories/${storyId}`]);
  assert.equal(await prisma.siteVisitor.count({ where: { visitorId: visitor.visitorId } }), 1);
});

test("Edit is owner-only and preserves original content relationships", async () => {
  await assert.rejects(editStory(stranger, storyId, { title: "Unauthorized", content: "Must never be persisted by this test." }));
  await prisma.comment.create({ data: { storyId, userId: owner, body: "Comment fixture" } });
  await prisma.reaction.create({ data: { storyId, userId: owner, type: "LOVE" } });
  const before = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
  await editStory(owner, storyId, { title: "Edited fixture", content: "Updated content used only by this integration test." });
  const after = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
  assert.equal(after.createdAt.getTime(), before.createdAt.getTime());
  assert.equal(after.totalReadSeconds, before.totalReadSeconds);
  assert.equal(after.authorId, owner);
  assert.ok(after.updatedAt >= before.updatedAt);
});

test("soft delete survives client reconnect; Restore preserves all data and ownership", async () => {
  const before = await prisma.story.findUniqueOrThrow({ where: { id: storyId }, include: { comments: true, reactions: true, views: true } });
  await assert.rejects(moveStoryToTrash(stranger, storyId));
  await moveStoryToTrash(owner, storyId);
  await prisma.$disconnect(); // No React state or process-local Trash storage.
  const deleted = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
  assert.ok(deleted.deletedAt);
  assert.equal(await prisma.story.findFirst({ where: { id: storyId, deletedAt: null } }), null);
  await assert.rejects(restoreStory(stranger, storyId));
  await assert.rejects(editStory(owner, storyId, { title: "Deleted", content: "Must not edit a deleted story fixture." }));
  await assert.rejects(recordStoryActivity(storyId, visitor, metadata, { userId: null }));
  await assert.rejects(recordStoryActivity(storyId, visitor, metadata, { userId: null }, 15));
  await assert.rejects(withActiveStory(storyId, tx => tx.comment.create({ data: { storyId, userId: owner, body: "Must fail" } })));
  await assert.rejects(withActiveStory(storyId, tx => tx.reaction.updateMany({ where: { storyId }, data: { type: "ANGRY" } })));
  await restoreStory(owner, storyId);
  const restored = await prisma.story.findUniqueOrThrow({ where: { id: storyId }, include: { comments: true, reactions: true, views: true } });
  assert.equal(restored.deletedAt, null);
  assert.equal(restored.id, before.id);
  assert.equal(restored.title, before.title);
  assert.equal(restored.content, before.content);
  assert.equal(restored.createdAt.getTime(), before.createdAt.getTime());
  assert.equal(restored.totalReadSeconds, before.totalReadSeconds);
  assert.deepEqual(restored.comments, before.comments);
  assert.deepEqual(restored.reactions, before.reactions);
  assert.deepEqual(restored.views, before.views);
});
