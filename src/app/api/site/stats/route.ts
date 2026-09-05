import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSiteStats } from "@/lib/site-stats";

export async function GET() {
  const session = await getSession();
  const headers = { "Cache-Control": "private, no-store" };
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  try { return NextResponse.json(await getSiteStats(), { headers }); }
  catch { return NextResponse.json({ error: "Statistics unavailable" }, { status: 503, headers }); }
}
