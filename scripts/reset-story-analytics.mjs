// Explicit operator action only. Never import this script from a migration/build.
if (process.env.CONFIRM_RESET_STORY_ANALYTICS !== 'YES') {
  console.error('Aborted. Set CONFIRM_RESET_STORY_ANALYTICS=YES explicitly to clear story analytics.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Aborted. Supply DATABASE_URL explicitly for the intended database.');
  process.exit(1);
}
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
try {
  const target = new URL(process.env.DATABASE_URL);
  console.log(`Target: ${target.hostname}:${target.port || '5432'}${target.pathname}`);
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '45s'`;
    // Same order as normal tracking: Story first, then StoryView. EXCLUSIVE
    // permits reads while waiting for tracking/mutations to finish. It prevents
    // concurrent activity from being lost between counts, deletion and reset.
    await tx.$executeRaw`LOCK TABLE "Story" IN EXCLUSIVE MODE`;
    await tx.$executeRaw`LOCK TABLE "StoryView" IN EXCLUSIVE MODE`;
    const stories = await tx.story.count();
    const views = await tx.storyView.count();
    const time = await tx.story.aggregate({ _sum: { totalReadSeconds: true } });
    console.log(`Stories: ${stories}`);
    console.log(`StoryView rows to delete: ${views}`);
    console.log(`Total story read seconds to reset: ${time._sum.totalReadSeconds || 0}`);
    await tx.storyView.deleteMany();
    // Raw update deliberately preserves Story.updatedAt and every other column.
    const reset = await tx.$executeRaw`UPDATE "Story" SET "totalReadSeconds" = 0`;
    return { remaining: await tx.storyView.count(), reset };
  }, { maxWait: 5000, timeout: 60000 });
  console.log(`StoryView rows remaining: ${result.remaining}`);
  console.log(`Stories reset: ${result.reset}`);
  console.log('Committed. Users, stories, comments, reactions, accounts and global site analytics were preserved.');
} catch {
  console.error('Reset failed; the transaction was rolled back. Check the target, database permissions and active traffic before retrying.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
