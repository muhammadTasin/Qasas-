import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function GET(request: Request, context: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const story = await prisma.story.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, authorId: true },
  });

  if (!story || story.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [uniqueViewsCount, totalReadSeconds, recentViewers] = await Promise.all([
    prisma.storyView.count({ where: { storyId: story.id } }),
    prisma.storyView.aggregate({
      where: { storyId: story.id },
      _sum: { totalReadSeconds: true },
    }),
    prisma.storyView.findMany({
      where: { storyId: story.id },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    }),
  ]);

  const totalRead = totalReadSeconds._sum.totalReadSeconds || 0;
  const avgReadSecondsPerView = uniqueViewsCount
    ? Math.round(totalRead / uniqueViewsCount)
    : 0;

  return NextResponse.json({
    uniqueViewsCount,
    avgReadSecondsPerView,
    viewers: recentViewers,
  });
}
