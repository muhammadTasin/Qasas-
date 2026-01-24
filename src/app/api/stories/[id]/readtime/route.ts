import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getGeoFromHeaders, getUaInfo, getVisitorIdentity } from "@/lib/analytics";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  seconds: z.number().int().min(1).max(30),
});

const RATE_WINDOW_MS = 10_000;
const rateMap = new Map<string, number>();

function rateKey(storyId: string, visitorId: string | null, ipHash: string | null) {
  return `${storyId}:${visitorId || ipHash || "anon"}`;
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const storyId = parsedParams.data.id;
  const seconds = parsedBody.data.seconds;

  const headers = request.headers;
  const { visitorId, ipHash } = getVisitorIdentity(headers);

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const key = rateKey(storyId, visitorId, ipHash);
  const now = Date.now();
  const last = rateMap.get(key);
  if (last && now - last < RATE_WINDOW_MS) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  rateMap.set(key, now);

  const geo = getGeoFromHeaders(headers);
  const ua = getUaInfo(headers);

  await prisma.$transaction(async (tx) => {
    await tx.story.update({
      where: { id: storyId },
      data: {
        totalReadSeconds: { increment: seconds },
      },
    });

    if (visitorId) {
      await tx.storyView.upsert({
        where: { storyId_visitorId: { storyId, visitorId } },
        create: {
          storyId,
          visitorId,
          ipHash,
          totalReadSeconds: seconds,
          ...geo,
          ...ua,
        },
        update: {
          totalReadSeconds: { increment: seconds },
          ipHash,
          ...geo,
          ...ua,
        },
      });
    } else if (ipHash) {
      await tx.storyView.upsert({
        where: { storyId_ipHash: { storyId, ipHash } },
        create: {
          storyId,
          visitorId,
          ipHash,
          totalReadSeconds: seconds,
          ...geo,
          ...ua,
        },
        update: {
          totalReadSeconds: { increment: seconds },
          ...geo,
          ...ua,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
