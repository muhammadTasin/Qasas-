import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import InsightsRoute from "@/components/InsightsRoute";

import { getStoryInsights } from "@/lib/story-insights";

export const dynamic = "force-dynamic";

export default async function StoryInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  const { id } = await params;
  const story = await prisma.story.findFirst({
    where: { id, authorId: session.user.id, deletedAt: null }, select: { id: true, title: true },
  });
  if (!story) notFound();
  const insights = await getStoryInsights(story.id).catch(() => null);
  return insights ? <InsightsRoute data={insights} storyId={story.id} /> : <p className="max-w-4xl mx-auto p-8 text-ink-500">Insights are temporarily unavailable. Please try again later.</p>;
}
