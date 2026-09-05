import { prisma } from "./prisma";
import { approximateLocation, visitorLabel } from "./analytics";
import { deviceLabel } from "./device-info";

export async function getStoryInsights(storyId: string) {
  const [groups, recent] = await Promise.all([
    prisma.storyView.groupBy({
      by: ["isAuthenticated", "deviceType"], where: { storyId },
      _count: { _all: true }, _sum: { totalReadSeconds: true },
    }),
    prisma.storyView.findMany({
      where: { storyId }, orderBy: { lastSeenAt: "desc" }, take: 20,
      select: {
        id: true, visitorId: true, ipHash: true, deviceModel: true, devicePlatform: true,
        deviceType: true, os: true, browser: true, country: true, region: true, city: true,
        isAuthenticated: true, firstSeenAt: true, lastSeenAt: true, totalReadSeconds: true,
      },
    }),
  ]);
  let uniqueViewsCount = 0;
  let totalReadSeconds = 0;
  let loggedIn = 0;
  let guests = 0;
  let unknown = 0;
  let mobile = 0;
  let loggedInReadSeconds = 0;
  let guestReadSeconds = 0;
  for (const group of groups) {
    const count = group._count._all;
    uniqueViewsCount += count;
    totalReadSeconds += group._sum.totalReadSeconds || 0;
    if (group.isAuthenticated === true) loggedIn += count;
    else if (group.isAuthenticated === false) guests += count;
    else unknown += count;
    if (group.isAuthenticated === true) loggedInReadSeconds += group._sum.totalReadSeconds || 0;
    if (group.isAuthenticated === false) guestReadSeconds += group._sum.totalReadSeconds || 0;
    if (group.deviceType === "mobile") mobile += count;
  }
  // Explicitly construct the response. Internal identifiers and raw UA never
  // cross the server boundary, even for an authorized owner.
  const viewers = recent.map(view => ({
    visitorLabel: visitorLabel(view), deviceModel: deviceLabel(view),
    deviceType: view.deviceType, os: view.os, browser: view.browser,
    approximateLocation: approximateLocation(view),
    visitorKind: view.isAuthenticated === true ? "Logged in" : view.isAuthenticated === false ? "Guest" : "Unknown (legacy)",
    totalReadSeconds: view.totalReadSeconds,
    firstSeenAt: view.firstSeenAt.toISOString(), lastSeenAt: view.lastSeenAt.toISOString(),
  }));
  return {
    uniqueViewsCount, totalReadSeconds,
    avgReadSecondsPerView: uniqueViewsCount ? Math.round(totalReadSeconds / uniqueViewsCount) : 0,
    loggedIn, guests, unknown, loggedInReadSeconds, guestReadSeconds, mobilePercent: uniqueViewsCount ? Math.round(mobile / uniqueViewsCount * 100) : 0,
    viewers,
  };
}

export type InsightViewer = Awaited<ReturnType<typeof getStoryInsights>>["viewers"][number];
