-- Additive only: existing analytics remain unassigned until observed again.
-- Clearing historical story analytics is a separate, explicitly confirmed script.
ALTER TABLE "StoryView" ADD COLUMN "userId" TEXT;
ALTER TABLE "StoryView" ADD COLUMN "deviceArchitecture" TEXT;
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StoryView_storyId_userId_lastSeenAt_idx" ON "StoryView"("storyId", "userId", "lastSeenAt");
CREATE INDEX "StoryView_userId_idx" ON "StoryView"("userId");
