-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "publishKey" TEXT;

-- AlterTable
ALTER TABLE "StoryView" ADD COLUMN     "deviceModel" TEXT,
ADD COLUMN     "devicePlatform" TEXT,
ADD COLUMN     "isAuthenticated" BOOLEAN,
ADD COLUMN     "lastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SiteVisitor" ADD COLUMN     "deviceModel" TEXT,
ADD COLUMN     "devicePlatform" TEXT,
ADD COLUMN     "isAuthenticated" BOOLEAN,
ADD COLUMN     "lastEventAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SiteVisitEvent" ADD COLUMN     "isAuthenticated" BOOLEAN,
ADD COLUMN     "pathname" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Story_publishKey_key" ON "Story"("publishKey");

-- CreateIndex
CREATE INDEX "Story_deletedAt_createdAt_idx" ON "Story"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "StoryView_storyId_lastSeenAt_idx" ON "StoryView"("storyId", "lastSeenAt");

