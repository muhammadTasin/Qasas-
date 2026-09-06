import { z } from "zod";
import { NextResponse } from "next/server";
import { getArchitecture, getVisitorIdentity } from "./analytics";
import { getSession } from "./session";
import { trackingMetadata } from "./tracking";
import { StoryUnavailableError } from "./story-mutations";

const textHint = z.string().max(128).optional();
export const hintsSchema = z.object({ model: textHint, platform: textHint, mobile: z.boolean().optional(), architecture: textHint, browser: textHint, legacyPlatform: textHint }).optional();
export const activitySchema = z.object({ hints: hintsSchema });
export const readTimeSchema = activitySchema.extend({ seconds: z.number().int().min(1).max(30) });
export const siteVisitSchema = activitySchema.extend({ pathname: z.string().min(1).max(256).transform(path => path.split(/[?#]/)[0]).refine(path => /^\/(?:$|about$|signin$|signup$|me$|write$|stories\/[a-zA-Z0-9_-]+(?:\/(?:edit|insights))?$)/.test(path)) });

const recent = new Map<string, number>();
export function locallyThrottled(key: string) {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < 1000) return true;
  if (recent.size >= 10000) {
    for (const [entry, time] of recent) if (now - time > 1000) recent.delete(entry);
    if (recent.size >= 10000) recent.delete(recent.keys().next().value!);
  }
  recent.set(key, now);
  return false;
}

export class InvalidTrackingRequest extends Error {}

export async function readTrackingBody(request: Request): Promise<unknown> {
  if (request.headers.get("sec-fetch-site") === "cross-site" || (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)) throw new InvalidTrackingRequest();
  // Bound actual bytes, not just the optional Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) return {};
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 4096) { await reader.cancel(); throw new InvalidTrackingRequest(); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  text += decoder.decode();
  try { return text ? JSON.parse(text) : {}; } catch { throw new InvalidTrackingRequest(); }
}

export async function trackingContext(request: Request, hints: z.infer<typeof hintsSchema>, scope: string) {
  const identity = getVisitorIdentity(request.headers);
  if (!identity.visitorId && !identity.ipHash) return null;
  const session = await getSession();
  const userId = session?.user?.id || null;
  // Site identity reconciliation must run even during rapid account switches.
  // Its database event gate already works across instances. Story gates retain
  // their existing behavior.
  if (scope !== "site" && locallyThrottled(`${scope}:${identity.visitorId || identity.ipHash}:${userId || "guest"}`)) return null;
  return {
    identity, metadata: trackingMetadata(request.headers, hints || {}, Boolean(userId)),
    reader: { userId, deviceArchitecture: getArchitecture(request.headers, hints) },
  };
}

let lastErrorLogged = 0;
export function trackingError(error: unknown) {
  if (error instanceof StoryUnavailableError) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (error instanceof InvalidTrackingRequest || error instanceof z.ZodError) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (Date.now() - lastErrorLogged > 60000) {
    console.warn("Analytics unavailable. Check ANALYTICS_SALT, database connectivity, and applied migrations.");
    lastErrorLogged = Date.now();
  }
  return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 });
}
