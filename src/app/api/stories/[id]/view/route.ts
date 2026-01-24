import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getGeoFromHeaders, getUaInfo, getVisitorIdentity } from "@/lib/analytics";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request, context: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  const storyId = parsed.data.id;
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }
  const headers = request.headers;
  const { visitorId, ipHash } = getVisitorIdentity(headers);
  const geo = getGeoFromHeaders(headers);
  const ua = getUaInfo(headers);

  if (!visitorId && !ipHash) {
    return NextResponse.json({ ok: true });
  }

  if (visitorId) {
    await prisma.storyView.upsert({
      where: { storyId_visitorId: { storyId, visitorId } },
      create: {
        storyId,
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
    await prisma.storyView.upsert({
      where: { storyId_ipHash: { storyId, ipHash } },
      create: {
        storyId,
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

  return NextResponse.json({ ok: true });
}
