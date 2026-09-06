import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !["localhost", "127.0.0.1"].includes(new URL(connection).hostname) || new URL(connection).pathname !== "/qasas_test") throw new Error("Dedicated localhost qasas_test database required.");

test("reset CLI refuses unconfirmed execution, preserves all unrelated data, rolls back failure and is repeatable", async () => {
  const url = new URL(connection);
  const database = `qasas_reset_${randomUUID().replaceAll("-", "")}`;
  const pgEnv = { ...process.env, PGHOST: url.searchParams.get("host") || url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) };
  const sql = (statement: string) => execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", statement], { env: { ...pgEnv, PGDATABASE: "postgres" }, encoding: "utf8" });
  sql(`CREATE DATABASE "${database}"`);
  url.pathname = `/${database}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() };
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const run = (confirmation?: string) => {
    const childEnv = { ...env, CONFIRM_RESET_STORY_ANALYTICS: confirmation };
    return spawnSync(process.execPath, ["scripts/reset-story-analytics.mjs"], { env: childEnv, encoding: "utf8" });
  };
  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
    const user = await db.user.create({ data: { email: "reset-fixture@example.invalid", name: "Preserved name", passwordHash: "synthetic-existing-hash", accounts: { create: { provider: "google", providerAccountId: "synthetic-subject", type: "oauth" } } } });
    const story = await db.story.create({ data: { authorId: user.id, title: "Keep the story", content: "Keep every byte of this content.", totalReadSeconds: 18,
      comments: { create: { userId: user.id, body: "Keep the comment" } }, reactions: { create: { userId: user.id, type: "LOVE" } },
      views: { create: { visitorId: randomUUID(), userId: user.id, isAuthenticated: true, totalReadSeconds: 18 } },
    } });
    await db.story.create({ data: { authorId: user.id, title: "Keep Trash", content: "Soft deleted content", deletedAt: new Date(), totalReadSeconds: 7, views: { create: { visitorId: randomUUID(), isAuthenticated: false, totalReadSeconds: 7 } } } });
    await db.siteVisitor.create({ data: { visitorId: randomUUID() } });
    await db.siteVisitEvent.create({ data: { pathname: "/", isAuthenticated: false } });
    const snapshot = async () => ({ users: await db.user.findMany(), accounts: await db.account.findMany(), comments: await db.comment.findMany(), reactions: await db.reaction.findMany(), siteVisitors: await db.siteVisitor.findMany(), siteEvents: await db.siteVisitEvent.findMany(), stories: (await db.story.findMany({ orderBy: { id: "asc" } })).map(({ totalReadSeconds, ...row }) => { void totalReadSeconds; return row; }) });
    const before = await snapshot();
    for (const confirmation of [undefined, "NO", "yes"]) {
      const result = run(confirmation); assert.equal(result.status, 1); assert.match(result.stderr, /Aborted/);
      assert.equal(await db.storyView.count(), 2); assert.equal((await db.story.findUniqueOrThrow({ where: { id: story.id } })).totalReadSeconds, 18);
    }
    // A simulated update failure must roll back the preceding StoryView delete.
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_test_reset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic test failure'; END; $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_test_reset BEFORE UPDATE ON "Story" FOR EACH ROW EXECUTE FUNCTION fail_test_reset()`);
    const failed = run("YES"); assert.equal(failed.status, 1); assert.match(failed.stderr, /rolled back/);
    assert.equal(await db.storyView.count(), 2); assert.deepEqual(await snapshot(), before);
    await db.$executeRawUnsafe(`DROP TRIGGER fail_test_reset ON "Story"`);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = run("YES"); assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Stories: 2/); assert.match(result.stdout, /StoryView rows remaining: 0/); assert.match(result.stdout, /Stories reset: 2/);
      if (!attempt) { assert.match(result.stdout, /StoryView rows to delete: 2/); assert.match(result.stdout, /Total story read seconds to reset: 25/); }
      assert.equal(await db.storyView.count(), 0); assert.equal(await db.story.count({ where: { totalReadSeconds: { not: 0 } } }), 0);
      assert.deepEqual(await snapshot(), before);
    }
  } finally {
    await db.$disconnect();
    sql(`DROP DATABASE "${database}"`);
  }
});
