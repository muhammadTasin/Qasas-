"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { STORY_LIST_TAG } from "./story-data";
import { editStory, moveStoryToTrash, publishStory, restoreStory, withActiveStory } from "./story-mutations";

const storySchema = z.object({ title: z.string().min(3).max(160), content: z.string().min(20) });
const idSchema = z.string().min(1).max(128);

async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  return session;
}

function invalidateStory(storyId: string) {
  updateTag(STORY_LIST_TAG);
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath(`/stories/${storyId}`);
  revalidatePath(`/stories/${storyId}/edit`);
  revalidatePath(`/stories/${storyId}/insights`);
}

export async function createStoryAction(formData: FormData) {
  const session = await requireSession();
  const parsed = storySchema.safeParse(Object.fromEntries(formData));
  const submission = z.string().uuid().safeParse(formData.get("submissionId"));
  if (!parsed.success || !submission.success) return { error: "Enter a title of 3–160 characters and a story of at least 20 characters." };
  try {
    const id = await publishStory(session.user.id, { ...parsed.data, submissionId: submission.data });
    updateTag(STORY_LIST_TAG);
    revalidatePath("/");
    revalidatePath("/me");
    return { redirectTo: `/stories/${id}` };
  } catch { return { error: "Could not publish your story. Your text is still here; please try again." }; }
}

export async function updateStoryAction(formData: FormData) {
  const session = await requireSession();
  const id = idSchema.safeParse(formData.get("storyId"));
  const parsed = storySchema.safeParse(Object.fromEntries(formData));
  if (!id.success || !parsed.success) return { error: "Enter a title of 3–160 characters and a story of at least 20 characters." };
  try {
    await editStory(session.user.id, id.data, parsed.data);
    invalidateStory(id.data);
    return { redirectTo: `/stories/${id.data}` };
  } catch { return { error: "Could not save this story. Check that it is still active and belongs to you." }; }
}

export async function deleteStoryAction(formData: FormData) {
  const session = await requireSession();
  const id = idSchema.safeParse(formData.get("storyId"));
  if (!id.success) return { error: "Invalid story." };
  try {
    await moveStoryToTrash(session.user.id, id.data);
    invalidateStory(id.data);
    return { redirectTo: "/" };
  } catch { return { error: "Could not delete this story. Check that it is still active and belongs to you." }; }
}

export async function restoreStoryAction(formData: FormData) {
  const session = await requireSession();
  const id = idSchema.safeParse(formData.get("storyId"));
  if (!id.success) return { error: "Invalid story." };
  try {
    await restoreStory(session.user.id, id.data);
    invalidateStory(id.data);
    return { redirectTo: "/me" };
  } catch { return { error: "Could not restore this story. Check that it is in your Trash." }; }
}

export async function reactToStoryAction(formData: FormData) {
  const session = await requireSession();
  const storyId = idSchema.parse(formData.get("storyId"));
  const type = z.enum(["LOVE", "SORROW", "ANGRY"]).parse(formData.get("type"));
  await withActiveStory(storyId, tx => tx.reaction.upsert({
    where: { storyId_userId: { storyId, userId: session.user.id } },
    create: { storyId, userId: session.user.id, type }, update: { type }, select: { id: true },
  }));
  revalidatePath(`/stories/${storyId}`);
}

export async function addCommentAction(formData: FormData) {
  const session = await requireSession();
  const storyId = idSchema.parse(formData.get("storyId"));
  const body = z.string().min(1).max(1000).parse(formData.get("body"));
  await withActiveStory(storyId, tx => tx.comment.create({
    data: { storyId, userId: session.user.id, body }, select: { id: true },
  }));
  revalidatePath(`/stories/${storyId}`);
}

export async function deleteCommentAction(formData: FormData) {
  const session = await requireSession();
  const commentId = idSchema.parse(formData.get("commentId"));
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, userId: session.user.id, story: { deletedAt: null } }, select: { storyId: true },
  });
  if (!comment) throw new Error("Unauthorized");
  await withActiveStory(comment.storyId, tx => tx.comment.deleteMany({ where: { id: commentId, userId: session.user.id } }));
  revalidatePath(`/stories/${comment.storyId}`);
}
