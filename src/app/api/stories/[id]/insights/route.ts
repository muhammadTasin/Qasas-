import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStoryInsights } from "@/lib/story-insights";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const { id } = await context.params;
  const story = await prisma.story.findFirst({ where: { id, authorId: session.user.id, deletedAt: null }, select: { id: true } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404, headers });
  try { return NextResponse.json(await getStoryInsights(story.id), { headers }); }
  catch { return NextResponse.json({ error: "Insights unavailable" }, { status: 503, headers }); }
}
