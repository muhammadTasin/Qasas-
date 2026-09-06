import StoryEditor from "@/components/StoryEditor";
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

  return <StoryEditor action={updateStoryAction} label="Save changes" pendingLabel="Saving..." story={story} />;
}
