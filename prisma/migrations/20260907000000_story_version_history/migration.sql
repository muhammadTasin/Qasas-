BEGIN;

ALTER TABLE "Story" ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "StoryVersion" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredFromVersion" INTEGER,
    CONSTRAINT "StoryVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoryVersion_version_check" CHECK ("version" > 0),
    CONSTRAINT "StoryVersion_restoredFromVersion_check" CHECK ("restoredFromVersion" > 0 AND "restoredFromVersion" < "version")
);

CREATE UNIQUE INDEX "StoryVersion_storyId_version_key" ON "StoryVersion"("storyId", "version");
ALTER TABLE "StoryVersion" ADD CONSTRAINT "StoryVersion_storyId_fkey"
    FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the current state of every existing story, including Trash. Edits
-- predating this feature cannot be reconstructed. No existing row is changed.
INSERT INTO "StoryVersion" ("id", "storyId", "version", "title", "content", "createdAt")
SELECT 'initial:' || "id", "id", 1, "title", "content", "updatedAt" FROM "Story";

COMMIT;
