import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStoryVersions, StoryHistoryDenied } from "@/lib/story-versions";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const { id } = await context.params;
  const cursor = new URL(request.url).searchParams.get("before");
  const before = cursor === null ? undefined : Number(cursor);
  if (before !== undefined && (!Number.isInteger(before) || before < 1 || before > 2147483647)) {
    return NextResponse.json({ error: "Invalid version" }, { status: 400, headers });
  }
  try { return NextResponse.json(await getStoryVersions(session.user.id, id, before), { headers }); }
  catch (error) {
    return NextResponse.json({ error: error instanceof StoryHistoryDenied ? "Story not found" : "History unavailable" },
      { status: error instanceof StoryHistoryDenied ? 404 : 503, headers });
  }
}
