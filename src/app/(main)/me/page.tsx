import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deleteStoryAction, restoreStoryAction } from "@/lib/actions";
import MutationForm from "@/components/MutationForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams: Promise<{ trash?: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  const trash = (await searchParams).trash === "1";
  const stories = await prisma.story.findMany({
    where: { authorId: session.user.id, deletedAt: trash ? { not: null } : null },
    orderBy: trash ? { deletedAt: "desc" } : { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });

  return (
    <div className="max-w-4xl mx-auto pt-6 px-4 pb-20 space-y-6">
      <section className="liquid-glass rounded-[2.5rem] px-8 py-10">
        <h1 className="font-serif text-3xl font-bold text-ink-900">{trash ? "Deleted stories" : "My stories"}</h1>
        <p className="mt-2 text-sm text-ink-500">Keep track of what you have shared.</p>
        <Link href={trash ? "/me" : "/me?trash=1"} className="mt-4 inline-block rounded-full border border-emerald-900/10 px-4 py-2 text-sm">
          {trash ? "My stories" : "Trash"}
        </Link>
      </section>
      <section className="space-y-4">
        {stories.length === 0 ? (
          <div className="liquid-glass rounded-3xl px-6 py-6 text-sm text-ink-500">
            {trash ? "No deleted stories." : "No stories yet. Write your first one."}
          </div>
        ) : stories.map(story => (
          <div key={story.id} className="liquid-glass flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-5">
            <div>
              <h3 className="font-serif text-xl font-bold text-ink-800">{story.title}</h3>
              <p className="text-xs text-ink-500">{story.createdAt.toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {trash ? (
                <MutationForm action={restoreStoryAction} label="Restore" pendingLabel="Restoring..." buttonClassName="rounded-full border border-emerald-900/10 px-4 py-2">
                  <input type="hidden" name="storyId" value={story.id} />
                </MutationForm>
              ) : (
                <>
                  <Link href={`/stories/${story.id}`} className="rounded-full border border-emerald-900/10 px-4 py-2">View</Link>
                  <Link href={`/stories/${story.id}/edit`} className="rounded-full border border-emerald-900/10 px-4 py-2">Edit</Link>
                  <MutationForm action={deleteStoryAction} label="Delete" pendingLabel="Deleting..." buttonClassName="rounded-full border border-rose-200 px-4 py-2 text-rose-600">
                    <input type="hidden" name="storyId" value={story.id} />
                  </MutationForm>
                </>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
