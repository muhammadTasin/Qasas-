import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStoryVersion, StoryHistoryDenied } from "@/lib/story-versions";

export async function GET(_request: Request, context: { params: Promise<{ id: string; version: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const { id, version: rawVersion } = await context.params;
  const version = Number(rawVersion);
  if (!Number.isInteger(version) || version < 1 || version > 2147483647) return NextResponse.json({ error: "Invalid version" }, { status: 400, headers });
  try { return NextResponse.json(await getStoryVersion(session.user.id, id, version), { headers }); }
  catch (error) {
    return NextResponse.json({ error: error instanceof StoryHistoryDenied ? "Story not found" : "History unavailable" },
      { status: error instanceof StoryHistoryDenied ? 404 : 503, headers });
  }
}
