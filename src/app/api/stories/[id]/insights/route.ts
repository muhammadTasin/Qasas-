import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStoryInsights, StoryInsightsDenied } from "@/lib/story-insights";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const { id } = await context.params;
  try { return NextResponse.json(await getStoryInsights(id, session.user.id), { headers }); }
  catch (error) {
    if (error instanceof StoryInsightsDenied) return NextResponse.json({ error: "Story not found" }, { status: 404, headers });
    return NextResponse.json({ error: "Insights unavailable" }, { status: 503, headers });
  }
}
