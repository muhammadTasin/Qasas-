import MutationForm from "@/components/MutationForm";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { updateStoryAction } from "@/lib/actions";

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const { id } = await params;
  const story = await prisma.story.findFirst({
    where: { id, authorId: session.user.id, deletedAt: null },
    select: { id: true, authorId: true, title: true, content: true },
  });

  if (!story) {
    redirect("/");
  }

  if (story.authorId !== session.user.id) {
    redirect(`/stories/${story.id}`);
  }

  return (
    <div className="glass mx-auto max-w-3xl rounded-[32px] px-8 py-10">
      <h1 className="text-3xl">Edit story</h1>
      <MutationForm action={updateStoryAction} className="mt-6 flex flex-col gap-4"
        buttonClassName="w-fit rounded-full bg-[#2d6a6f] px-5 py-3 text-sm text-white"
        label="Save changes" pendingLabel="Saving...">
        <input type="hidden" name="storyId" value={story.id} />
        <input
          name="title"
          minLength={3}
          maxLength={160}
          required
          defaultValue={story.title}
          className="glass rounded-2xl px-4 py-3 text-base outline-none"
        />
        <textarea
          name="content"
          minLength={20}
          required
          rows={12}
          defaultValue={story.content}
          className="glass rounded-2xl px-4 py-3 text-sm leading-relaxed outline-none"
        />
      </MutationForm>
    </div>
  );
}
