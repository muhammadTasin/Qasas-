import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import InsightsTable from "@/components/InsightsTable";
import { formatReadTime } from "@/lib/format";
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
  return (
    <div className="space-y-6">
      <section className="glass rounded-[32px] px-8 py-10">
        <p className="text-xs uppercase tracking-[0.4em] text-muted">Insights</p>
        <h1 className="mt-3 text-3xl">{story.title}</h1>
        {insights ? (
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
            <span>Unique views: {insights.uniqueViewsCount}</span>
            <span>Avg read: {formatReadTime(insights.avgReadSecondsPerView)}</span>
            <span>Total read: {formatReadTime(insights.totalReadSeconds)}</span>
            <span>Logged in: {insights.loggedIn}</span>
            <span>Guests: {insights.guests}</span>
            <span>Mobile: {insights.mobilePercent}%</span>
            {insights.unknown ? <span>Unknown (legacy): {insights.unknown}</span> : null}
          </div>
        ) : <p className="mt-4 text-sm text-muted">Insights are temporarily unavailable. Please try again later.</p>}
      </section>
      {insights ? <InsightsTable views={insights.viewers} /> : null}
      <p className="text-xs text-muted">
        Private analytics. Location is approximate, based on network information; VPNs, mobile carriers and ISP routing can change it. GPS is never requested.
        Guest / logged-in status reflects the latest activity from each browser. Older records may have unknown status.
      </p>
    </div>
  );
}
