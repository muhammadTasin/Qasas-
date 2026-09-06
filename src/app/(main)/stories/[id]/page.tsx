import InsightsLauncher from "@/components/InsightsLauncher";
import { ArrowLeft, Clock, Eye } from "lucide-react";
import MutationForm from "@/components/MutationForm";
import { deleteStoryAction } from "@/lib/actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import ReactionPills from "@/components/ReactionPills";
import CommentSection from "@/components/CommentSection";
import StoryEngagementTracker from "@/components/StoryEngagementTracker";
import { estimateReadTime } from "@/lib/format";
import type { ReactionType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [story, session] = await Promise.all([
    prisma.story.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, authorId: true, title: true, content: true,
        createdAt: true, totalReadSeconds: true,
        author: { select: { name: true } },
        reactions: { select: { userId: true, type: true } },
        comments: {
          select: { id: true, userId: true, body: true, createdAt: true, user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getSession(),
  ]);
  if (!story) notFound();

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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-4xl mx-auto pt-6 px-4 pb-20">
      <StoryEngagementTracker storyId={story.id} />
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full liquid-glass text-sm text-ink-500 hover:text-emerald-900 font-medium touch-spring"><ArrowLeft size={16} />Back</Link>
        {userId === story.authorId && <div className="flex items-center gap-2">
          <Link href={`/stories/${story.id}/edit`} className="inline-flex items-center px-3 py-2 rounded-full border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-50 transition-colors">Edit</Link>
          <InsightsLauncher storyId={story.id} />
          <MutationForm action={deleteStoryAction} label="Delete" pendingLabel="Deleting..." buttonClassName="inline-flex items-center px-3 py-2 rounded-full border border-rose-200 text-rose-600 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-50 transition-colors">
            <input type="hidden" name="storyId" value={story.id} />
          </MutationForm>
        </div>}
      </div>
      <article className="reading-surface rounded-[2.5rem] p-8 sm:p-16 mb-12 relative overflow-hidden">
        <div className="flex flex-col items-center gap-4 mb-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50/50 border border-emerald-100/50 text-[10px] font-sans font-bold uppercase tracking-widest text-emerald-800">
                {story.author.name || "Anonymous"}
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-ink-900 leading-[1.1] tracking-tight">
                {story.title}
            </h1>

            <div className="flex items-center gap-4 text-xs font-sans text-ink-400 font-medium">
                <span>{story.createdAt.toLocaleDateString()}</span>
                <span className="w-1 h-1 rounded-full bg-emerald-200"></span>
                <span className="flex items-center gap-1"><Clock size={12} /> {estimateReadTime(story.content)} min</span>
                <span className="w-1 h-1 rounded-full bg-emerald-200"></span>
                <span className="flex items-center gap-1" title="Aggregate read time by all users">
                    <Eye size={12} /> {(story.totalReadSeconds / 60).toFixed(0)}m total read
                </span>
            </div>
        </div>

        <div className="prose prose-xl prose-p:font-serif prose-headings:font-serif max-w-[65ch] mx-auto text-ink-800 leading-[1.8] whitespace-pre-wrap selection:bg-emerald-100">
            {story.content}
        </div>

        <div className="mt-24 pt-12 border-t border-emerald-900/5 flex flex-col items-center">
            <p className="text-xs font-sans text-ink-400 mb-8 uppercase tracking-widest font-bold opacity-60">Reaction</p>

            <ReactionPills storyId={story.id} counts={counts} selected={userReaction} disabled={!userId} />
            {!userId && (
                <Link href="/signin" className="mt-6 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors">Sign in to react</Link>
            )}
        </div>
      </article>

      <CommentSection storyId={story.id} comments={story.comments} currentUserId={userId} />
    </div>
  );
}
