import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSiteInsights } from "@/lib/site-insights";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  if (!session.user.isSiteAdmin) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  try { return NextResponse.json(await getSiteInsights(), { headers }); }
  catch { return NextResponse.json({ error: "Insights unavailable" }, { status: 503, headers }); }
}
