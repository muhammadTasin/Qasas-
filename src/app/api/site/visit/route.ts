import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getGeoFromHeaders, getUaInfo, getVisitorIdentity } from "@/lib/analytics";

const bodySchema = z.object({}).passthrough();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  bodySchema.parse(body);
  const headers = request.headers;
  const { visitorId, ipHash } = getVisitorIdentity(headers);
  const geo = getGeoFromHeaders(headers);
  const ua = getUaInfo(headers);

  if (!visitorId && !ipHash) {
    return NextResponse.json({ ok: true });
  }

  if (visitorId) {
    await prisma.siteVisitor.upsert({
      where: { visitorId },
      create: {
        visitorId,
        ipHash,
        ...geo,
        ...ua,
      },
      update: {
        ipHash,
        ...geo,
        ...ua,
      },
    });
  } else if (ipHash) {
    await prisma.siteVisitor.upsert({
      where: { ipHash },
      create: {
        visitorId,
        ipHash,
        ...geo,
        ...ua,
      },
      update: {
        ...geo,
        ...ua,
      },
    });
  }

  await prisma.siteVisitEvent.create({
    data: {
      visitorId,
      ipHash,
    },
  });

  return NextResponse.json({ ok: true });
}
