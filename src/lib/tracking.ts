import { prisma } from "./prisma";
import { anonymousSuffix, getGeoFromHeaders, getUaInfo, type VisitorIdentity } from "./analytics";
import type { DeviceHints } from "./device-info";
import { withActiveStory } from "./story-mutations";

export function trackingMetadata(headers: Headers, hints: DeviceHints, isAuthenticated: boolean) {
  const ua = getUaInfo(headers, hints);
  return { ...getGeoFromHeaders(headers), ...ua, deviceModel: ua.deviceModel || undefined, isAuthenticated };
}
export type TrackingMetadata = ReturnType<typeof trackingMetadata>;

export async function recordSiteVisit(identity: VisitorIdentity, metadata: TrackingMetadata, pathname: string) {
  const where = identity.visitorId ? { visitorId: identity.visitorId } : identity.ipHash ? { ipHash: identity.ipHash } : null;
  if (!where) return;
  await prisma.$transaction(async tx => {
    const visitor = await tx.siteVisitor.upsert({
      where, create: { ...identity, ...metadata }, update: { lastSeenAt: new Date() }, select: { id: true },
    });
    const now = new Date();
    // An atomic database gate works across Vercel instances and browser tabs.
    const claimed = await tx.siteVisitor.updateMany({
      where: { id: visitor.id, OR: [{ lastEventAt: null }, { lastEventAt: { lte: new Date(now.getTime() - 3000) } }, { isAuthenticated: { not: metadata.isAuthenticated } }] },
      data: { ...metadata, lastEventAt: now },
    });
    if (claimed.count) {
      await tx.siteVisitEvent.create({
        data: { visitorId: anonymousSuffix(identity), pathname, isAuthenticated: metadata.isAuthenticated }, select: { id: true },
      });
    } else {
      await tx.siteVisitor.update({ where: { id: visitor.id }, data: metadata, select: { id: true } });
    }
  }, { maxWait: 2000, timeout: 4000 });
}

export async function recordStoryActivity(storyId: string, identity: VisitorIdentity, metadata: TrackingMetadata, seconds = 0) {
  const where = identity.visitorId ? { storyId_visitorId: { storyId, visitorId: identity.visitorId } }
    : identity.ipHash ? { storyId_ipHash: { storyId, ipHash: identity.ipHash } } : null;
  if (!where) return;
  await withActiveStory(storyId, async tx => {
    const view = await tx.storyView.upsert({
      where, create: { storyId, ...identity, ...metadata }, update: metadata,
      select: { id: true, lastReadAt: true },
    });
    if (!seconds) return;
    const now = new Date();
    const acceptedSeconds = Math.min(seconds, view.lastReadAt ? Math.floor((now.getTime() - view.lastReadAt.getTime()) / 1000) : seconds);
    if (acceptedSeconds < 1) return;
    const claimed = await tx.storyView.updateMany({
      where: { id: view.id, OR: [{ lastReadAt: null }, { lastReadAt: { lte: new Date(now.getTime() - 10000) } }] },
      data: { totalReadSeconds: { increment: acceptedSeconds }, lastReadAt: now },
    });
    if (claimed.count) {
      // Activity must not change a story's content-edit timestamp.
      await tx.$executeRaw`UPDATE "Story" SET "totalReadSeconds" = "totalReadSeconds" + ${acceptedSeconds} WHERE "id" = ${storyId}`;
    }
  }, seconds > 0);
}
