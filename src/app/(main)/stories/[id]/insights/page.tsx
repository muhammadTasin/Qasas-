import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import InsightsTable from "@/components/InsightsTable";
import { formatReadTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StoryInsightsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const story = await prisma.story.findUnique({
    where: { id: params.id },
  });

  if (!story) {
    redirect("/");
  }

  if (story.authorId !== session.user.id) {
    redirect(`/stories/${story.id}`);
  }

  const [views, viewCount, totalRead] = await Promise.all([
    prisma.storyView.findMany({
      where: { storyId: story.id },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    }),
    prisma.storyView.count({ where: { storyId: story.id } }),
    prisma.storyView.aggregate({
      where: { storyId: story.id },
      _sum: { totalReadSeconds: true },
    }),
  ]);

  const totalReadSeconds = totalRead._sum.totalReadSeconds || 0;
  const avgReadSeconds = viewCount ? Math.round(totalReadSeconds / viewCount) : 0;

  return (
    <div className="space-y-6">
      <section className="glass rounded-[32px] px-8 py-10">
        <p className="text-xs uppercase tracking-[0.4em] text-muted">Insights</p>
        <h1 className="mt-3 text-3xl">{story.title}</h1>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
          <span>Unique views: {viewCount}</span>
          <span>Avg read: {formatReadTime(avgReadSeconds)}</span>
          <span>Total read: {formatReadTime(totalReadSeconds)}</span>
        </div>
      </section>

      <InsightsTable views={views} />
    </div>
  );
}
