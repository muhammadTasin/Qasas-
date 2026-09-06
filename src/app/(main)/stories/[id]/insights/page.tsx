import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import InsightsRoute from "@/components/InsightsRoute";

import { getStoryInsights, StoryInsightsDenied } from "@/lib/story-insights";

export const dynamic = "force-dynamic";

export default async function StoryInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  const { id } = await params;
  const insights = await getStoryInsights(id, session.user.id).catch(error => {
    if (error instanceof StoryInsightsDenied) notFound();
    return null;
  });
  return insights ? <InsightsRoute data={insights} storyId={id} /> : <p className="max-w-4xl mx-auto p-8 text-ink-500">Insights are temporarily unavailable. Please try again later.</p>;
}
