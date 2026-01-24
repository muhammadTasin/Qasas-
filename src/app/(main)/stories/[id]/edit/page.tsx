import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { updateStoryAction } from "@/lib/actions";

export default async function EditStoryPage({
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

  return (
    <div className="glass mx-auto max-w-3xl rounded-[32px] px-8 py-10">
      <h1 className="text-3xl">Edit story</h1>
      <form action={updateStoryAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="storyId" value={story.id} />
        <input
          name="title"
          required
          defaultValue={story.title}
          className="glass rounded-2xl px-4 py-3 text-base outline-none"
        />
        <textarea
          name="content"
          required
          rows={12}
          defaultValue={story.content}
          className="glass rounded-2xl px-4 py-3 text-sm leading-relaxed outline-none"
        />
        <button
          type="submit"
          className="w-fit rounded-full bg-[#2d6a6f] px-5 py-3 text-sm text-white"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
