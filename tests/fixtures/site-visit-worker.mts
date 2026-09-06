const connection = process.env.DATABASE_URL;
if (!connection || !["localhost", "127.0.0.1"].includes(new URL(connection).hostname) || !/^\/qasas_voices_[a-f0-9]+$/.test(new URL(connection).pathname)) throw new Error("Isolated voices fixture database required.");
const { prisma } = await import("../../src/lib/prisma");
const { recordSiteVisit, trackingMetadata } = await import("../../src/lib/tracking");
try {
  await recordSiteVisit({ visitorId: process.argv[3], ipHash: null }, trackingMetadata(new Headers(), {}, true), "/", process.argv[2]);
} finally { await prisma.$disconnect(); }
