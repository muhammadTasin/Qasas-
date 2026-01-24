import Link from "next/link";
import type { Story, User } from "@prisma/client";
import { estimateReadTime, formatReadTime } from "@/lib/format";

export default function StoryCard({
  story,
  author,
}: {
  story: Story;
  author: User;
}) {
  const excerpt = story.content.slice(0, 180);
  const estimated = estimateReadTime(story.content);

  return (
    <article className="glass rounded-3xl px-6 py-5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>By {author.name || author.email}</span>
        <span>{story.createdAt.toLocaleDateString()}</span>
      </div>
      <Link href={`/stories/${story.id}`} className="mt-3 block">
        <h3 className="text-2xl leading-tight">{story.title}</h3>
        <p className="mt-3 text-sm text-muted">{excerpt}...</p>
      </Link>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        <span>Estimated read: {estimated} min</span>
        <span>Total read: {formatReadTime(story.totalReadSeconds)}</span>
      </div>
    </article>
  );
}
