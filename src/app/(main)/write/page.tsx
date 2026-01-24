import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStoryAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function WritePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }

  return (
    <div className="glass mx-auto max-w-3xl rounded-[32px] px-8 py-10">
      <h1 className="text-3xl">Write a new story</h1>
      <form action={createStoryAction} className="mt-6 flex flex-col gap-4">
        <input
          name="title"
          required
          placeholder="Story title"
          className="glass rounded-2xl px-4 py-3 text-base outline-none"
        />
        <textarea
          name="content"
          required
          rows={12}
          placeholder="Share your story..."
          className="glass rounded-2xl px-4 py-3 text-sm leading-relaxed outline-none"
        />
        <button
          type="submit"
          className="w-fit rounded-full bg-[#2d6a6f] px-5 py-3 text-sm text-white"
        >
          Publish story
        </button>
      </form>
    </div>
  );
}
