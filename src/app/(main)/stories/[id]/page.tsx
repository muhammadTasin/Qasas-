import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ReactionPills from "@/components/ReactionPills";
import CommentSection from "@/components/CommentSection";
import StoryEngagementTracker from "@/components/StoryEngagementTracker";
import { estimateReadTime, formatReadTime } from "@/lib/format";
import type { ReactionType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function StoryPage({
  params,
}: {
  params: { id: string };
}) {
  const story = await prisma.story.findUnique({
    where: { id: params.id },
    include: {
      author: true,
      reactions: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!story) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;
  const userReaction = story.reactions.find((reaction) => reaction.userId === userId)
    ?.type;

  const counts: Record<ReactionType, number> = {
    LOVE: 0,
    SORROW: 0,
    ANGRY: 0,
  };
  for (const reaction of story.reactions) {
    counts[reaction.type] += 1;
  }

  const paragraphs = story.content.split(/\n+/).filter(Boolean);
  const estimated = estimateReadTime(story.content);

  return (
    <div className="space-y-8">
      <StoryEngagementTracker storyId={story.id} />

      <section className="glass rounded-[32px] px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>By {story.author.name || story.author.email}</span>
          <span>{story.createdAt.toLocaleDateString()}</span>
        </div>
        <h1 className="mt-4 text-4xl leading-tight">{story.title}</h1>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
          <span>Estimated read: {estimated} min</span>
          <span>Total read: {formatReadTime(story.totalReadSeconds)}</span>
        </div>
        {userId === story.authorId ? (
          <div className="mt-5 flex gap-3 text-sm">
            <Link
              href={`/stories/${story.id}/edit`}
              className="rounded-full border border-black/10 px-4 py-2"
            >
              Edit
            </Link>
            <Link
              href={`/stories/${story.id}/insights`}
              className="rounded-full border border-black/10 px-4 py-2"
            >
              Insights
            </Link>
          </div>
        ) : null}
      </section>

      <section className="glass rounded-[32px] px-8 py-10">
        <div className="reading mx-auto">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="glass rounded-[32px] px-8 py-8">
        <h3 className="text-xl">How did it feel?</h3>
        <p className="mt-2 text-sm text-muted">
          Choose one emotion. You can change it anytime.
        </p>
        <div className="mt-4">
          <ReactionPills
            storyId={story.id}
            counts={counts}
            selected={userReaction}
            disabled={!userId}
          />
          {!userId ? (
            <p className="mt-2 text-xs text-muted">Sign in to react.</p>
          ) : null}
        </div>
      </section>

      <CommentSection
        storyId={story.id}
        comments={story.comments}
        currentUserId={userId}
      />
    </div>
  );
}
