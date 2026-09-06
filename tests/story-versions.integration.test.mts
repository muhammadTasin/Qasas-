import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/qasas_test") {
  throw new Error("Set TEST_DATABASE_URL to a dedicated localhost database named qasas_test.");
}
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
const { prisma } = await import("../src/lib/prisma");
const { publishStory, editStory, moveStoryToTrash, restoreStory } = await import("../src/lib/story-mutations");
const { getStoryVersions, getStoryVersion, restoreStoryVersion, StoryVersionConflict } = await import("../src/lib/story-versions");
let owner: string;
let stranger: string;
const original = { title: "Original story", content: "  Original story text.\nhttps://example.invalid/image.png\n<em>Preserve this literally.</em>  " };
const createStory = () => publishStory(owner, { ...original, submissionId: randomUUID() });
const snapshots = (storyId: string) => prisma.storyVersion.findMany({ where: { storyId }, orderBy: { version: "asc" } });
before(async () => {
  owner = (await prisma.user.create({ data: { email: `versions-${randomUUID()}@example.invalid` } })).id;
  stranger = (await prisma.user.create({ data: { email: `versions-${randomUUID()}@example.invalid` } })).id;
});
after(async () => {
  await prisma.story.deleteMany({ where: { authorId: { in: [owner, stranger] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, stranger] } } });
  await prisma.$disconnect();
});

test("publish retries create one immutable initial snapshot", async () => {
  const input = { ...original, submissionId: randomUUID() };
  const ids = await Promise.all(Array.from({ length: 5 }, () => publishStory(owner, input)));
  assert.equal(new Set(ids).size, 1);
  const versions = await snapshots(ids[0]);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].version, 1);
  assert.equal(versions[0].content, original.content);
});

test("edit preserves exact content, skips no-op saves and excludes analytics/metadata changes", async () => {
  const id = await createStory();
  const baseline = (await snapshots(id))[0];
  await prisma.story.update({ where: { id }, data: { totalReadSeconds: 25 } });
  await editStory(owner, id, { ...original, expectedVersion: 1 });
  await editStory(owner, id, { ...original, content: original.content.replace(/\n/g, "\r\n"), expectedVersion: 1 });
  assert.equal((await snapshots(id)).length, 1);
  assert.equal((await prisma.story.findUniqueOrThrow({ where: { id } })).content, original.content);
  await editStory(owner, id, { title: "Edited title", content: original.content, expectedVersion: 1 });
  await editStory(owner, id, { title: "Edited title", content: original.content, expectedVersion: 1 });
  const versions = await snapshots(id);
  assert.deepEqual(versions[0], baseline);
  assert.deepEqual(versions.map(v => v.version), [1, 2]);
  const story = await prisma.story.findUniqueOrThrow({ where: { id } });
  assert.equal(story.currentVersion, 2);
  assert.equal(story.totalReadSeconds, 25);
  assert.equal(story.content, original.content);
  assert.equal(story.updatedAt.getTime(), versions[1].createdAt.getTime());
});

test("restoring an older version appends a new published version and retains relationships/history", async () => {
  const id = await createStory();
  await prisma.story.update({ where: { id }, data: {
    totalReadSeconds: 42, comments: { create: { userId: owner, body: "Keep me" } },
    reactions: { create: { userId: owner, type: "LOVE" } }, views: { create: { visitorId: randomUUID() } },
  } });
  await editStory(owner, id, { title: "Version two", content: "Second published story contents." });
  await editStory(owner, id, { title: "Version three", content: "Third published story contents." });
  const previous = await snapshots(id);
  const before = await prisma.story.findUniqueOrThrow({ where: { id }, include: { comments: true, reactions: true, views: true } });
  await restoreStoryVersion(owner, id, 1, 3);
  const restored = await prisma.story.findUniqueOrThrow({ where: { id }, include: { comments: true, reactions: true, views: true } });
  assert.equal(restored.currentVersion, 4);
  assert.equal(restored.title, original.title);
  assert.equal(restored.content, original.content);
  for (const key of ["id", "authorId", "createdAt", "publishKey", "totalReadSeconds", "comments", "reactions", "views"] as const) assert.deepEqual(restored[key], before[key]);
  assert.deepEqual((await snapshots(id)).slice(0, 3), previous);
  assert.equal((await getStoryVersion(owner, id, 4)).restoredFromVersion, 1);
  // Restoring an older identical text is still an explicit restore event.
  await restoreStoryVersion(owner, id, 1, 4);
  assert.equal((await snapshots(id)).length, 5);
  await restoreStoryVersion(owner, id, 5, 5);
  assert.equal((await snapshots(id)).length, 5);
});

test("history list, preview, edits and restoration deny guests, other owners and unrelated versions", async () => {
  const id = await createStory();
  const before = await snapshots(id);
  for (const userId of ["", stranger]) {
    await assert.rejects(getStoryVersions(userId, id));
    await assert.rejects(getStoryVersion(userId, id, 1));
    await assert.rejects(restoreStoryVersion(userId, id, 1, 1));
    await assert.rejects(editStory(userId, id, { title: "Intruder", content: "Unauthorized story contents." }));
  }
  await assert.rejects(getStoryVersion(owner, id, 999));
  await assert.rejects(restoreStoryVersion(owner, id, 999, 1));
  assert.deepEqual(await snapshots(id), before);
});

test("concurrent edits serialize every snapshot and stale editors/restores cannot overwrite newer work", async () => {
  const id = await createStory();
  const outcomes = await Promise.allSettled(["A", "B"].map(label => editStory(owner, id, {
    title: `Concurrent ${label}`, content: `Concurrent ${label} story contents.`, expectedVersion: 1,
  })));
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  assert.ok(outcomes.some(r => r.status === "rejected" && r.reason instanceof StoryVersionConflict));
  await assert.rejects(restoreStoryVersion(owner, id, 1, 1), StoryVersionConflict);
  await Promise.all(["C", "D"].map(label => editStory(owner, id, { title: `Concurrent ${label}`, content: `Concurrent ${label} story contents.` })));
  assert.deepEqual((await snapshots(id)).map(v => v.version), [1, 2, 3, 4]);
  const story = await prisma.story.findUniqueOrThrow({ where: { id } });
  assert.equal((await getStoryVersion(owner, id, 4)).content, story.content);
});

test("failed snapshot insertion rolls back the story and preserves the existing history", async () => {
  const id = await createStory();
  // An intentionally conflicting fixture simulates a failed history write.
  await prisma.storyVersion.create({ data: { storyId: id, version: 2, ...original } });
  const before = await prisma.story.findUniqueOrThrow({ where: { id } });
  const history = await snapshots(id);
  await assert.rejects(editStory(owner, id, { title: "Should roll back", content: "This content must never replace the story." }));
  assert.deepEqual(await prisma.story.findUniqueOrThrow({ where: { id } }), before);
  assert.deepEqual(await snapshots(id), history);
});

test("Trash hides history, restoring from Trash retains it, permanent deletion cascades snapshots", async () => {
  const id = await createStory();
  await editStory(owner, id, { title: "Edited before Trash", content: original.content });
  const history = await snapshots(id);
  await moveStoryToTrash(owner, id);
  await assert.rejects(getStoryVersions(owner, id));
  await assert.rejects(getStoryVersion(owner, id, 1));
  await assert.rejects(restoreStoryVersion(owner, id, 1, 2));
  assert.deepEqual(await snapshots(id), history);
  await restoreStory(owner, id);
  assert.equal((await getStoryVersions(owner, id)).versions.length, 2);
  assert.deepEqual(await snapshots(id), history);
  await prisma.story.delete({ where: { id } });
  assert.equal((await snapshots(id)).length, 0);
});

test("history pagination exposes all versions in order with no full content in the list", async () => {
  const id = await createStory();
  for (let version = 2; version <= 23; version++) await editStory(owner, id, { title: `Version ${version}`, content: original.content });
  const first = await getStoryVersions(owner, id);
  assert.equal(first.currentVersion, 23);
  assert.equal(first.versions.length, 20);
  assert.equal(first.nextBefore, 4);
  assert.equal("content" in first.versions[0], false);
  const second = await getStoryVersions(owner, id, first.nextBefore!);
  assert.deepEqual(second.versions.map(v => v.version), [3, 2, 1]);
  assert.equal(second.nextBefore, null);
});
