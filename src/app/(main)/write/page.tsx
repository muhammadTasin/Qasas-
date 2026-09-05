import StoryEditor from "@/components/StoryEditor";
import { getSession } from "@/lib/session";
import { createStoryAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function WritePage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  return <StoryEditor action={createStoryAction} label="Publish Story" pendingLabel="Publishing..." publish />;
}
