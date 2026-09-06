import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class StoryHistoryDenied extends Error {
  constructor() { super("Story not found or you do not own it."); }
}

export class StoryVersionConflict extends Error {
  constructor() { super("This story changed in another tab. Copy your unsaved text, then reload before saving or restoring."); }
}

type LockedStory = { id: string; title: string; content: string; currentVersion: number; updatedAt: Date };

// The row lock serializes edits/restores with each other and with Trash. Owner
// checks run inside the same transaction as every history read or write.
export async function withOwnedStory<T>(authorId: string, storyId: string,
  work: (tx: Prisma.TransactionClient, story: LockedStory) => Promise<T>, exclusive = false) {
  return prisma.$transaction(async tx => {
    const [story] = await tx.$queryRaw<LockedStory[]>(Prisma.sql`
      SELECT "id", "title", "content", "currentVersion", "updatedAt" FROM "Story"
      WHERE "id" = ${storyId} AND "authorId" = ${authorId} AND "deletedAt" IS NULL
      ${exclusive ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`}
    `);
    if (!story) throw new StoryHistoryDenied();
    return work(tx, story);
  }, { maxWait: 2000, timeout: 4000 });
}

export async function saveStoryVersion(tx: Prisma.TransactionClient, story: LockedStory,
  input: { title: string; content: string }, restoredFromVersion?: number) {
  // Also preserves a baseline for stories imported outside the publishing UI.
  await tx.storyVersion.createMany({ data: {
    storyId: story.id, version: story.currentVersion, title: story.title,
    content: story.content, createdAt: story.updatedAt,
  }, skipDuplicates: true });
  const version = story.currentVersion + 1;
  const createdAt = new Date();
  await tx.storyVersion.create({ data: { storyId: story.id, version, ...input, createdAt, restoredFromVersion } });
  await tx.story.update({ where: { id: story.id }, data: { ...input, currentVersion: version, updatedAt: createdAt } });
}

export function getStoryVersions(authorId: string, storyId: string, before?: number) {
  return withOwnedStory(authorId, storyId, async (tx, story) => {
    const rows = await tx.storyVersion.findMany({
      where: { storyId, ...(before ? { version: { lt: before } } : {}) },
      orderBy: { version: "desc" }, take: 21,
      select: { version: true, title: true, createdAt: true, restoredFromVersion: true },
    });
    const versions = rows.slice(0, 20);
    return { currentVersion: story.currentVersion, versions,
      nextBefore: rows.length > 20 ? versions[versions.length - 1].version : null };
  });
}

export function getStoryVersion(authorId: string, storyId: string, version: number) {
  return withOwnedStory(authorId, storyId, async tx => {
    const snapshot = await tx.storyVersion.findUnique({
      where: { storyId_version: { storyId, version } },
      select: { version: true, title: true, content: true, createdAt: true, restoredFromVersion: true },
    });
    if (!snapshot) throw new StoryHistoryDenied();
    return snapshot;
  });
}

export function restoreStoryVersion(authorId: string, storyId: string, version: number, expectedVersion: number) {
  return withOwnedStory(authorId, storyId, async (tx, story) => {
    if (story.currentVersion !== expectedVersion) throw new StoryVersionConflict();
    const snapshot = await tx.storyVersion.findUnique({ where: { storyId_version: { storyId, version } } });
    if (!snapshot || version > story.currentVersion) throw new StoryHistoryDenied();
    if (version === story.currentVersion) return;
    await saveStoryVersion(tx, story, { title: snapshot.title, content: snapshot.content }, version);
  }, true);
}
