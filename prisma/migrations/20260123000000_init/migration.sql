-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LOVE', 'SORROW', 'ANGRY');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "totalReadSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ReactionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryView" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "visitorId" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "deviceType" TEXT,
  "os" TEXT,
  "browser" TEXT,
  "country" TEXT,
  "region" TEXT,
  "city" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalReadSeconds" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteVisitor" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "deviceType" TEXT,
  "os" TEXT,
  "browser" TEXT,
  "country" TEXT,
  "region" TEXT,
  "city" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SiteVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteVisitEvent" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SiteVisitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Story_authorId_idx" ON "Story"("authorId");
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_storyId_userId_key" ON "Reaction"("storyId", "userId");
CREATE INDEX "Reaction_storyId_idx" ON "Reaction"("storyId");

-- CreateIndex
CREATE INDEX "Comment_storyId_idx" ON "Comment"("storyId");
CREATE INDEX "Comment_createdAt_idx" ON "Comment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoryView_storyId_visitorId_key" ON "StoryView"("storyId", "visitorId");
CREATE UNIQUE INDEX "StoryView_storyId_ipHash_key" ON "StoryView"("storyId", "ipHash");
CREATE INDEX "StoryView_storyId_idx" ON "StoryView"("storyId");
CREATE INDEX "StoryView_lastSeenAt_idx" ON "StoryView"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisitor_visitorId_key" ON "SiteVisitor"("visitorId");
CREATE UNIQUE INDEX "SiteVisitor_ipHash_key" ON "SiteVisitor"("ipHash");
CREATE INDEX "SiteVisitor_lastSeenAt_idx" ON "SiteVisitor"("lastSeenAt");
CREATE INDEX "SiteVisitor_firstSeenAt_idx" ON "SiteVisitor"("firstSeenAt");

-- CreateIndex
CREATE INDEX "SiteVisitEvent_createdAt_idx" ON "SiteVisitEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
