"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const storySchema = z.object({
  title: z.string().min(3).max(160),
  content: z.string().min(20),
});

const reactionSchema = z.enum(["LOVE", "SORROW", "ANGRY"]);

const commentSchema = z.object({
  body: z.string().min(1).max(1000),
});

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }
  return session;
}

export async function createStoryAction(formData: FormData) {
  const session = await requireSession();
  const parsed = storySchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    throw new Error("Invalid story payload");
  }

  const story = await prisma.story.create({
    data: {
      authorId: session.user.id,
      title: parsed.data.title,
      content: parsed.data.content,
    },
  });

  revalidatePath("/");
  redirect(`/stories/${story.id}`);
}

export async function updateStoryAction(formData: FormData) {
  const session = await requireSession();
  const storyId = z.string().parse(formData.get("storyId"));
  const parsed = storySchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    throw new Error("Invalid story payload");
  }

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.authorId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.story.update({
    where: { id: storyId },
    data: { title: parsed.data.title, content: parsed.data.content },
  });

  revalidatePath(`/stories/${storyId}`);
  redirect(`/stories/${storyId}`);
}

export async function deleteStoryAction(formData: FormData) {
  const session = await requireSession();
  const storyId = z.string().parse(formData.get("storyId"));
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.authorId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.story.delete({ where: { id: storyId } });
  revalidatePath("/me");
  redirect("/me");
}

export async function reactToStoryAction(formData: FormData) {
  const session = await requireSession();
  const storyId = z.string().parse(formData.get("storyId"));
  const type = reactionSchema.parse(formData.get("type"));

  await prisma.reaction.upsert({
    where: {
      storyId_userId: { storyId, userId: session.user.id },
    },
    create: {
      storyId,
      userId: session.user.id,
      type,
    },
    update: {
      type,
    },
  });

  revalidatePath(`/stories/${storyId}`);
}

export async function addCommentAction(formData: FormData) {
  const session = await requireSession();
  const storyId = z.string().parse(formData.get("storyId"));
  const parsed = commentSchema.safeParse({
    body: formData.get("body"),
  });
  if (!parsed.success) {
    throw new Error("Invalid comment payload");
  }

  await prisma.comment.create({
    data: {
      storyId,
      userId: session.user.id,
      body: parsed.data.body,
    },
  });

  revalidatePath(`/stories/${storyId}`);
}

export async function deleteCommentAction(formData: FormData) {
  const session = await requireSession();
  const commentId = z.string().parse(formData.get("commentId"));
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(`/stories/${comment.storyId}`);
}
