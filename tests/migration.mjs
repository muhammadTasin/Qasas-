import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['localhost', '127.0.0.1'].includes(new URL(connection).hostname) || new URL(connection).pathname !== '/qasas_test') {
  throw new Error('Set TEST_DATABASE_URL to a dedicated localhost database named qasas_test.');
}
for (const existingGoogleAccount of [false, true]) {
  const url = new URL(connection);
  const database = `qasas_migration_${randomUUID().replaceAll('-', '')}`;
  const baseEnv = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) };
  const sql = (database, statement) => execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', statement], { env: { ...baseEnv, PGDATABASE: database }, encoding: 'utf8' }).trim();
  const temp = mkdtempSync(join(tmpdir(), 'qasas-migration-'));
  let created = false;
  try {
    sql('postgres', `CREATE DATABASE "${database}"`);
    created = true;
    url.pathname = `/${database}`;
    const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() };
    cpSync('prisma/schema.prisma', join(temp, 'schema.prisma'));
    mkdirSync(join(temp, 'migrations'));
    cpSync('prisma/migrations/migration_lock.toml', join(temp, 'migrations/migration_lock.toml'));
    for (const migration of ['20260123000000_init', '20260123171840_']) cpSync(`prisma/migrations/${migration}`, join(temp, 'migrations', migration), { recursive: true });
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', join(temp, 'schema.prisma')], { env, stdio: 'pipe' });
    // Synthetic pre-upgrade rows; the fixture lives only in this temporary DB.
    sql(database, `
      INSERT INTO "User" (id,email,"passwordHash","updatedAt") VALUES ('legacy-user','fixture@example.invalid','test-fixture',now());
      INSERT INTO "Story" (id,"authorId",title,content,"totalReadSeconds","updatedAt") VALUES ('legacy-story','legacy-user','Legacy fixture','Existing legacy content',19,now());
      INSERT INTO "Comment" (id,"storyId","userId",body) VALUES ('legacy-comment','legacy-story','legacy-user','Preserved fixture');
      INSERT INTO "Reaction" (id,"storyId","userId",type) VALUES ('legacy-reaction','legacy-story','legacy-user','LOVE');
      INSERT INTO "StoryView" (id,"storyId","visitorId",os,"totalReadSeconds","lastSeenAt") VALUES ('legacy-view','legacy-story','${randomUUID()}','Windows',19,now());
      INSERT INTO "SiteVisitor" (id,"visitorId","lastSeenAt") VALUES ('legacy-site-visitor','${randomUUID()}',now());
      INSERT INTO "SiteVisitEvent" (id) VALUES ('legacy-event');
    `);
    const snapshot = () => sql(database, `SELECT json_build_object('stories',(SELECT json_agg(json_build_array(id,"authorId",title,content,"totalReadSeconds","createdAt")) FROM "Story"),'views',(SELECT json_agg(json_build_array(id,"visitorId","totalReadSeconds")) FROM "StoryView"),'comments',(SELECT json_agg(row_to_json(c)) FROM "Comment" c),'reactions',(SELECT json_agg(row_to_json(r)) FROM "Reaction" r),'siteCount',(SELECT count(*) FROM "SiteVisitor"),'eventCount',(SELECT count(*) FROM "SiteVisitEvent"));`);
    if (existingGoogleAccount) {
      // Recreate the original deployment's Google-compatible schema and link.
      // The migration must also work when Account already exists with real data.
      sql(database, readFileSync('prisma/migrations/20260906120000_google_auth_compatibility/migration.sql', 'utf8'));
      sql(database, `
        INSERT INTO "User" (id,email,"passwordHash","updatedAt") VALUES ('legacy-google-user','google-fixture@example.invalid',NULL,now());
        INSERT INTO "Account" (id,"userId",type,provider,"providerAccountId","access_token") VALUES ('legacy-google-link','legacy-google-user','oauth','google','original-google-subject','synthetic-existing-token');
        INSERT INTO "Story" (id,"authorId",title,content,"updatedAt") VALUES ('legacy-google-story','legacy-google-user','Original Google story','Original Google content',now());
      `);
    }
    // Bring the fixture to the latest main schema before testing the new migration.
    for (const migration of ['20260905180000_private_analytics_and_story_trash', '20260906120000_google_auth_compatibility']) cpSync(`prisma/migrations/${migration}`, join(temp, 'migrations', migration), { recursive: true });
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', join(temp, 'schema.prisma')], { env, stdio: 'pipe' });
    sql(database, `INSERT INTO "StoryView" (id,"storyId","visitorId","isAuthenticated","lastSeenAt") VALUES ('legacy-auth-view','legacy-story','${randomUUID()}',TRUE,now())`);
    const originalGoogle = existingGoogleAccount ? sql(database, `SELECT row_to_json(a) FROM "Account" a WHERE id = 'legacy-google-link'`) : null;
    const googleUser = existingGoogleAccount ? sql(database, `SELECT row_to_json(u) FROM "User" u WHERE id = 'legacy-google-user'`) : null;
    const before = snapshot();
    const originalUser = sql(database, `SELECT json_build_array(id,email,"passwordHash","createdAt","updatedAt") FROM "User" WHERE id = 'legacy-user'`);
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'pipe' });
    assert.equal(snapshot(), before);
    assert.equal(sql(database, `SELECT count(*) FROM "StoryView" WHERE "userId" IS NULL AND "deviceArchitecture" IS NULL`), '2');
    assert.equal(sql(database, `SELECT "isAuthenticated" FROM "StoryView" WHERE id = 'legacy-auth-view'`), 't');
    assert.equal(sql(database, `SELECT count(*) FROM pg_indexes WHERE indexname IN ('StoryView_storyId_userId_lastSeenAt_idx', 'StoryView_userId_idx')`), '2');
    assert.equal(sql(database, `SELECT confdeltype FROM pg_constraint WHERE conname = 'StoryView_userId_fkey'`), 'n');
    assert.equal(sql(database, `SELECT json_build_array(id,email,"passwordHash","createdAt","updatedAt") FROM "User" WHERE id = 'legacy-user'`), originalUser);
    assert.equal(sql(database, `SELECT count(*) FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'sessionVersion'`), '0');
    assert.equal(sql(database, `SELECT count(*) FROM information_schema.tables WHERE table_name IN ('PasswordResetToken', 'PasswordResetRateLimit')`), '0');
    assert.equal(sql(database, `SELECT count(*) FROM "Account"`), existingGoogleAccount ? '1' : '0');
    if (existingGoogleAccount) {
      assert.equal(sql(database, `SELECT row_to_json(a) FROM "Account" a WHERE id = 'legacy-google-link'`), originalGoogle);
      assert.equal(sql(database, `SELECT row_to_json(u) FROM "User" u WHERE id = 'legacy-google-user'`), googleUser);
    }
    assert.equal(sql(database, `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'passwordHash'`), 'YES');
    assert.equal(sql(database, `SELECT count(*) FROM "Story" WHERE "deletedAt" IS NULL AND "publishKey" IS NULL`), existingGoogleAccount ? '2' : '1');
    assert.equal(sql(database, `SELECT count(*) FROM "StoryView" WHERE "deviceModel" IS NULL AND "isAuthenticated" IS NULL`), '1');
    console.log(`PASS: migration ${existingGoogleAccount ? 'with original Google accounts' : 'without an Account table'} preserves users, passwords, story ownership, comments, reactions and analytics; no password-reset schema is added.`);
  } finally {
    // Only the uniquely named temporary database created by this script is removed.
    if (created) sql('postgres', `DROP DATABASE "${database}"`);
    rmSync(temp, { recursive: true, force: true });
  }
}
