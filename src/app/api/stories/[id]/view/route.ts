import { NextResponse } from "next/server";
import { z } from "zod";
import { recordStoryActivity } from "@/lib/tracking";
import { activitySchema, readTrackingBody, trackingContext, trackingError } from "@/lib/tracking-request";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().min(1).max(128).parse((await context.params).id);
    const body = activitySchema.parse(await readTrackingBody(request));
    const visitor = await trackingContext(request, body.hints, `view:${id}`);
    if (visitor) await recordStoryActivity(id, visitor.identity, visitor.metadata);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return trackingError(error); }
}
