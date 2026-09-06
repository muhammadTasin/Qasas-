import { prisma } from "./prisma";
import { anonymousSuffix, getGeoFromHeaders, getUaInfo, type VisitorIdentity } from "./analytics";
import { preferredModel, type DeviceHints } from "./device-info";
import { withActiveStory } from "./story-mutations";

export function trackingMetadata(headers: Headers, hints: DeviceHints, isAuthenticated: boolean) {
  const ua = getUaInfo(headers, hints);
  return { ...getGeoFromHeaders(headers), ...ua, deviceModel: ua.deviceModel || undefined, isAuthenticated };
}
export type TrackingMetadata = ReturnType<typeof trackingMetadata>;

// userId is supplied exclusively by the server session, never the request body.
export async function recordSiteVisit(identity: VisitorIdentity, metadata: TrackingMetadata, pathname: string, userId: string | null) {
  const where = identity.visitorId ? { visitorId: identity.visitorId } : identity.ipHash ? { ipHash: identity.ipHash } : null;
  if (!where) return;
  await prisma.$transaction(async tx => {
    const data = { ...metadata, isAuthenticated: Boolean(userId) };
    const visitor = await tx.siteVisitor.upsert({
      where, create: { ...identity, ...data, userId },
      // Logout changes current metadata, but must not erase the counting link.
      update: { lastSeenAt: new Date(), ...(userId ? { userId } : {}) }, select: { id: true },
    });
    const now = new Date();
    if (userId) {
      // One durable marker per User also retains people after account switching
      // on a shared browser. Do not change User.updatedAt or guest attribution.
      await tx.$executeRaw`UPDATE "User"
        SET "siteLastSeenAt" = GREATEST("siteLastSeenAt", ${now.toISOString()}::timestamp(3))
        WHERE "id" = ${userId}`;
    }
    // An atomic database gate works across Vercel instances and browser tabs.
    const claimed = await tx.siteVisitor.updateMany({
      where: { id: visitor.id, OR: [{ lastEventAt: null }, { lastEventAt: { lte: new Date(now.getTime() - 3000) } }, { isAuthenticated: { not: data.isAuthenticated } }] },
      data: { ...data, lastEventAt: now },
    });
    if (claimed.count) {
      await tx.siteVisitEvent.create({
        data: { visitorId: anonymousSuffix(identity), pathname, isAuthenticated: data.isAuthenticated }, select: { id: true },
      });
    } else {
      await tx.siteVisitor.update({ where: { id: visitor.id }, data, select: { id: true } });
    }
  }, { maxWait: 2000, timeout: 4000 });
}

export async function recordStoryActivity(storyId: string, identity: VisitorIdentity, metadata: TrackingMetadata, reader: { userId: string | null; deviceArchitecture?: string | null }, seconds = 0) {
  const where = identity.visitorId ? { storyId_visitorId: { storyId, visitorId: identity.visitorId } }
    : identity.ipHash ? { storyId_ipHash: { storyId, ipHash: identity.ipHash } } : null;
  if (!where) return;
  await withActiveStory(storyId, async tx => {
    const data = { ...metadata, userId: reader.userId, isAuthenticated: Boolean(reader.userId), deviceArchitecture: reader.deviceArchitecture || undefined };
    const view = await tx.storyView.upsert({
      where, create: { storyId, ...identity, ...data }, update: { ...data, deviceModel: undefined },
      select: { id: true, lastReadAt: true, deviceModel: true },
    });
    // The upsert holds this row's lock until commit. A later request without
    // entropy hints must not downgrade a previously exposed exact model.
    const model = preferredModel(metadata.deviceModel, view.deviceModel);
    if (model !== view.deviceModel) await tx.storyView.update({ where: { id: view.id }, data: { deviceModel: model } });
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
