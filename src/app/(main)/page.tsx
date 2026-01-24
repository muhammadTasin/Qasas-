import StoryCard from "@/components/StoryCard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await prisma.story.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: true },
  });

  return (
    <div className="space-y-8">
      <section className="glass rounded-[32px] px-8 py-10">
        <p className="text-xs uppercase tracking-[0.4em] text-muted">Qasas</p>
        <h1 className="mt-3 text-4xl leading-tight">
          Stories that feel like whispered letters.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted">
          This website is made to share your thoughts, like moner onnotshobder kotha.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {stories.length === 0 ? (
          <div className="glass rounded-3xl px-6 py-8">
            <p className="text-muted">No stories yet. Be the first to write one.</p>
          </div>
        ) : (
          stories.map((story) => (
            <StoryCard key={story.id} story={story} author={story.author} />
          ))
        )}
      </section>
    </div>
  );
}
