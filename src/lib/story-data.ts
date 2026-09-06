import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export const STORY_LIST_TAG = "public-stories";

export const getHomeStories = unstable_cache(async () => {
  const stories = await prisma.story.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, content: true, totalReadSeconds: true, createdAt: true, author: { select: { name: true } }, reactions: { select: { type: true } } },
  });
  // Cache serializable dates explicitly: cache hits and misses have the same shape.
  return stories.map(({ reactions, ...story }) => ({ ...story, createdAt: story.createdAt.toISOString(),
    reactionCounts: reactions.reduce((counts, reaction) => { counts[reaction.type]++; return counts; }, { LOVE: 0, SORROW: 0, ANGRY: 0 }),
  }));
}, ["home-stories-v3"], { tags: [STORY_LIST_TAG], revalidate: 60 });
