import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export const STORY_LIST_TAG = "public-stories";

export const getHomeStories = unstable_cache(async () => {
  const stories = await prisma.story.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, content: true, totalReadSeconds: true, createdAt: true, author: { select: { name: true } } },
  });
  // Cache serializable dates explicitly: cache hits and misses have the same shape.
  return stories.map(story => ({ ...story, createdAt: story.createdAt.toISOString() }));
}, ["home-stories-v2"], { tags: [STORY_LIST_TAG], revalidate: 60 });
