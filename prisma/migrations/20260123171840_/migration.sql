-- AlterTable
ALTER TABLE "SiteVisitor" ALTER COLUMN "lastSeenAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Story" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StoryView" ALTER COLUMN "lastSeenAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
