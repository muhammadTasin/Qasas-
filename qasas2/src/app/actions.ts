'use server';

import { prisma } from '@/lib/prisma';
import { cookies, headers } from 'next/headers';
import { ReactionType } from '@/types';
import { z } from 'zod';
import { createHash } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const isProd = process.env.NODE_ENV === 'production';
const ANALYTICS_SALT = process.env.ANALYTICS_SALT || 'dev-salt';
const VIEW_RATE_LIMIT_MS = 30_000;
const READ_RATE_LIMIT_MS = 5_000;
const MAX_READ_SECONDS = 120;

const StoryIdSchema = z.string().cuid();
const StoryCreateSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(20000),
});
const CommentSchema = z.object({
  storyId: StoryIdSchema,
  body: z.string().min(1).max(2000),
});
const ReadTimeSchema = z.object({
  storyId: StoryIdSchema,
  seconds: z.number().int().min(1).max(MAX_READ_SECONDS),
});
const ReactionSchema = z.object({
  storyId: StoryIdSchema,
  type: z.nativeEnum(ReactionType),
});

async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get('origin');
  const host = h.get('host');
  if (!origin || !host) return;
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) throw new Error('CSRF blocked');
  } catch {
    throw new Error('CSRF blocked');
  }
}

async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;
  return user?.id || null;
}

async function requireAuth() {
  const userId = await getSessionUserId();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

async function getClientIp() {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || '';
  return h.get('x-real-ip') || '';
}

function hashIp(ip: string) {
  if (!ip) return null;
  return createHash('sha256').update(`${ANALYTICS_SALT}:${ip}`).digest('hex');
}

// --- VISITOR ID UTILS ---
async function getVisitorId() {
  const cookieStore = await cookies();
  let vid = cookieStore.get('qasas_vid')?.value;
  if (!vid) {
    vid = crypto.randomUUID();
    cookieStore.set('qasas_vid', vid, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return vid || 'anonymous';
}

// --- SESSION ---
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as { id?: string; email?: string; name?: string | null };
  return { id: user.id, email: user.email, name: user.name };
}

// --- STORY ACTIONS ---
export async function getStories() {
  const stories = await prisma.story.findMany({
    include: {
      author: { select: { id: true, name: true } },
      reactions: { select: { type: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  return stories.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    reactionCounts: {
      LOVE: s.reactions.filter(r => r.type === 'LOVE').length,
      SORROW: s.reactions.filter(r => r.type === 'SORROW').length,
      ANGRY: s.reactions.filter(r => r.type === 'ANGRY').length,
    }
  }));
}

export async function getStory(id: string) {
  const storyId = StoryIdSchema.parse(id);
  const userId = await getSessionUserId();

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: {
      author: { select: { id: true, name: true } },
      reactions: { select: { userId: true, type: true } },
    }
  });

  if (!story) return null;

  const comments = await prisma.comment.findMany({
    where: { storyId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const reactionCounts = {
    LOVE: story.reactions.filter(r => r.type === 'LOVE').length,
    SORROW: story.reactions.filter(r => r.type === 'SORROW').length,
    ANGRY: story.reactions.filter(r => r.type === 'ANGRY').length,
  };

  const currentUserReaction = userId
    ? story.reactions.find(r => r.userId === userId)?.type as ReactionType
    : undefined;

  return {
    story: {
      ...story,
      createdAt: story.createdAt.toISOString(),
      updatedAt: story.updatedAt.toISOString(),
      reactionCounts,
      currentUserReaction
    },
    comments: comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }))
  };
}

export async function createStoryAction(title: string, content: string) {
  await assertSameOrigin();
  const userId = await requireAuth();
  const parsed = StoryCreateSchema.parse({ title, content });

  const wordCount = parsed.content.trim().split(/\s+/).length;
  const estimatedReadTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return await prisma.story.create({
    data: {
      title: parsed.title,
      content: parsed.content,
      authorId: userId,
      estimatedReadTimeMinutes
    }
  });
}

export async function deleteStoryAction(storyId: string) {
  await assertSameOrigin();
  const userId = await requireAuth();
  const parsedStoryId = StoryIdSchema.parse(storyId);

  const story = await prisma.story.findUnique({
    where: { id: parsedStoryId },
    select: { authorId: true },
  });

  if (!story || story.authorId !== userId) {
    throw new Error('Unauthorized');
  }

  await prisma.story.delete({ where: { id: parsedStoryId } });
  return { ok: true };
}

// --- INTERACTION ACTIONS ---
export async function toggleReactionAction(storyId: string, type: ReactionType) {
  await assertSameOrigin();
  const userId = await requireAuth();
  const parsed = ReactionSchema.parse({ storyId, type });

  const existing = await prisma.reaction.findUnique({
    where: { storyId_userId: { storyId: parsed.storyId, userId } }
  });

  if (existing) {
    if (existing.type === parsed.type) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.reaction.update({ where: { id: existing.id }, data: { type: parsed.type } });
    }
  } else {
    await prisma.reaction.create({
      data: { userId, storyId: parsed.storyId, type: parsed.type }
    });
  }
}

export async function addCommentAction(storyId: string, body: string) {
  await assertSameOrigin();
  const userId = await requireAuth();
  const parsed = CommentSchema.parse({ storyId, body });

  await prisma.comment.create({
    data: { storyId: parsed.storyId, userId, body: parsed.body }
  });
}

// --- ANALYTICS ACTIONS ---
export async function incrementReadTimeAction(storyId: string, seconds: number) {
  await assertSameOrigin();
  const parsed = ReadTimeSchema.parse({ storyId, seconds });
  const visitorId = await getVisitorId();
  const userId = await getSessionUserId();
  const ipHash = hashIp(await getClientIp());
  const now = new Date();

  const existing = await prisma.storyView.findFirst({
    where: {
      storyId: parsed.storyId,
      OR: [
        { visitorId },
        ...(ipHash ? [{ ipHash }] : []),
      ],
    },
  });

  if (existing && now.getTime() - existing.lastSeenAt.getTime() < READ_RATE_LIMIT_MS) {
    return;
  }

  await prisma.$transaction([
    prisma.story.update({
      where: { id: parsed.storyId },
      data: { totalReadSeconds: { increment: parsed.seconds } },
    }),
    prisma.storyView.upsert({
      where: existing
        ? { id: existing.id }
        : ipHash
          ? { storyId_ipHash: { storyId: parsed.storyId, ipHash } }
          : { storyId_visitorId: { storyId: parsed.storyId, visitorId } },
      create: {
        storyId: parsed.storyId,
        visitorId,
        userId: userId || undefined,
        ipHash: ipHash || undefined,
        totalReadSeconds: parsed.seconds,
        lastSeenAt: now,
      },
      update: {
        userId: userId || undefined,
        totalReadSeconds: { increment: parsed.seconds },
        lastSeenAt: now,
      },
    }),
  ]);
}

export async function recordViewAction(storyId: string) {
  await assertSameOrigin();
  const parsedStoryId = StoryIdSchema.parse(storyId);
  const visitorId = await getVisitorId();
  const userId = await getSessionUserId();
  const ipHash = hashIp(await getClientIp());
  const now = new Date();

  const existing = await prisma.storyView.findFirst({
    where: {
      storyId: parsedStoryId,
      OR: [
        { visitorId },
        ...(ipHash ? [{ ipHash }] : []),
      ],
    },
  });

  if (existing && now.getTime() - existing.lastSeenAt.getTime() < VIEW_RATE_LIMIT_MS) {
    return;
  }

  await prisma.storyView.upsert({
    where: existing
      ? { id: existing.id }
      : ipHash
        ? { storyId_ipHash: { storyId: parsedStoryId, ipHash } }
        : { storyId_visitorId: { storyId: parsedStoryId, visitorId } },
    create: {
      storyId: parsedStoryId,
      visitorId,
      userId: userId || undefined,
      ipHash: ipHash || undefined,
      lastSeenAt: now,
    },
    update: {
      userId: userId || undefined,
      lastSeenAt: now,
    },
  });
}

export async function getStoryAnalyticsAction(storyId: string) {
  const userId = await requireAuth();
  const parsedStoryId = StoryIdSchema.parse(storyId);

  const story = await prisma.story.findUnique({ where: { id: parsedStoryId } });
  if (!story || story.authorId !== userId) throw new Error('Unauthorized');

  const views = await prisma.storyView.findMany({
    where: { storyId: parsedStoryId },
    orderBy: { lastSeenAt: 'desc' }
  });

  const uniqueLoggedIn = new Set(views.filter(v => v.userId).map(v => v.userId));
  const guestKeys = new Set(
    views
      .filter(v => !v.userId)
      .map(v => v.visitorId || v.ipHash || v.id)
  );
  const totalReadTime = views.reduce((sum, v) => sum + (v.totalReadSeconds || 0), 0);
  const totalReadTimeLoggedIn = views
    .filter(v => v.userId)
    .reduce((sum, v) => sum + (v.totalReadSeconds || 0), 0);
  const totalReadTimeGuests = totalReadTime - totalReadTimeLoggedIn;

  const stats = {
    totalViews: views.length,
    uniqueLoggedIn: uniqueLoggedIn.size,
    uniqueGuests: guestKeys.size,
    totalReadTime,
    totalReadTimeLoggedIn,
    totalReadTimeGuests,
  };

  return {
    stats,
    views: views.map(v => ({
      id: v.id,
      storyId: v.storyId,
      visitorId: v.visitorId || undefined,
      userId: v.userId || undefined,
      deviceType: v.deviceType as any,
      os: v.os || 'Unknown',
      browser: v.browser || 'Unknown',
      location: { country: v.country, region: v.region, city: v.city },
      firstSeenAt: v.firstSeenAt.toISOString(),
      lastSeenAt: v.lastSeenAt.toISOString(),
      viewCount: 1,
      totalReadSeconds: v.totalReadSeconds,
    })),
  };
}

export async function getSiteStatsAction() {
  const totalPageViews = await prisma.storyView.count();
  const uniqueVisitors = await prisma.storyView.groupBy({
    by: ['visitorId'],
  });
  return {
    totalPageViews,
    uniqueVisitors: uniqueVisitors.length
  };
}
