import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoryAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const stories = await prisma.story.findMany({
    where: { authorId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <section className="glass rounded-[32px] px-8 py-10">
        <h1 className="text-3xl">My stories</h1>
        <p className="mt-2 text-sm text-muted">
          Keep track of what you have shared.
        </p>
      </section>

      <section className="space-y-4">
        {stories.length === 0 ? (
          <div className="glass rounded-3xl px-6 py-6 text-sm text-muted">
            No stories yet. Write your first one.
          </div>
        ) : (
          stories.map((story) => (
            <div
              key={story.id}
              className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-5"
            >
              <div>
                <h3 className="text-xl">{story.title}</h3>
                <p className="text-xs text-muted">
                  {story.createdAt.toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href={`/stories/${story.id}`}
                  className="rounded-full border border-black/10 px-4 py-2"
                >
                  View
                </Link>
                <Link
                  href={`/stories/${story.id}/edit`}
                  className="rounded-full border border-black/10 px-4 py-2"
                >
                  Edit
                </Link>
                <form action={deleteStoryAction}>
                  <input type="hidden" name="storyId" value={story.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-[#bd6a4c]/40 px-4 py-2 text-[#bd6a4c]"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
