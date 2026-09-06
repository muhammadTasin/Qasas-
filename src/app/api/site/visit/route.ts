import { NextResponse } from "next/server";
import { recordSiteVisit } from "@/lib/tracking";
import { readTrackingBody, siteVisitSchema, trackingContext, trackingError } from "@/lib/tracking-request";

export async function POST(request: Request) {
  try {
    const body = siteVisitSchema.parse(await readTrackingBody(request));
    const context = await trackingContext(request, body.hints, "site");
    if (context) await recordSiteVisit(context.identity, context.metadata, body.pathname, context.reader.userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return trackingError(error); }
}
