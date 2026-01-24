import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({}).passthrough();

export async function GET(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  querySchema.parse(query);
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [uniqueVisitorsLifetime, uniqueVisitorsLast30Days, totalVisits] =
    await Promise.all([
      prisma.siteVisitor.count(),
      prisma.siteVisitor.count({ where: { lastSeenAt: { gte: last30 } } }),
      prisma.siteVisitEvent.count(),
    ]);

  return NextResponse.json({
    uniqueVisitorsLifetime,
    uniqueVisitorsLast30Days,
    totalVisits,
  });
}
