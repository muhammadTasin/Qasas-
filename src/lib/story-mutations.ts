import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function publishStory(authorId: string, input: { title: string; content: string; submissionId: string }) {
  // Scoped to the authenticated author. A retry of the same form cannot publish twice.
  const publishKey = `${authorId}:${input.submissionId}`;
  const story = await prisma.story.upsert({
    where: { publishKey },
    create: { authorId, publishKey, title: input.title, content: input.content },
    // A nonempty update keeps this a database-native upsert under concurrent retries.
    update: { publishKey },
    select: { id: true, deletedAt: true },
  });
  if (story.deletedAt) throw new Error("This submission is in Trash. Restore it from My stories.");
  return story.id;
}

export async function editStory(authorId: string, storyId: string, input: { title: string; content: string }) {
  const result = await prisma.story.updateMany({
    where: { id: storyId, authorId, deletedAt: null },
    data: { title: input.title, content: input.content },
  });
  if (!result.count) throw new Error("Story not found or you do not own it.");
}

export async function moveStoryToTrash(authorId: string, storyId: string) {
  const result = await prisma.story.updateMany({
    where: { id: storyId, authorId, deletedAt: null }, data: { deletedAt: new Date() },
  });
  if (!result.count) throw new Error("Story not found or you do not own it.");
}

export async function restoreStory(authorId: string, storyId: string) {
  const result = await prisma.story.updateMany({
    where: { id: storyId, authorId, deletedAt: { not: null } }, data: { deletedAt: null },
  });
  if (!result.count) throw new Error("Deleted story not found or you do not own it.");
}

/** Keep availability checks and child writes ordered against soft deletion. */
export async function withActiveStory<T>(storyId: string, work: (tx: Prisma.TransactionClient) => Promise<T>, exclusive = false): Promise<T> {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Story" WHERE "id" = ${storyId} AND "deletedAt" IS NULL
      ${exclusive ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`}
    `);
    if (!rows.length) throw new StoryUnavailableError();
    return work(tx);
  }, { maxWait: 2000, timeout: 4000 });
}

export class StoryUnavailableError extends Error {
  constructor() { super("Story not found"); }
}
