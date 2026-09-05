import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['localhost', '127.0.0.1'].includes(new URL(connection).hostname) || new URL(connection).pathname !== '/qasas_test') {
  throw new Error('Set TEST_DATABASE_URL to a dedicated localhost database named qasas_test.');
}
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
  const snapshot = () => sql(database, `SELECT json_build_object('stories',(SELECT json_agg(json_build_array(id,title,content,"totalReadSeconds","createdAt")) FROM "Story"),'views',(SELECT json_agg(json_build_array(id,"visitorId","totalReadSeconds")) FROM "StoryView"),'comments',(SELECT json_agg(row_to_json(c)) FROM "Comment" c),'reactions',(SELECT json_agg(row_to_json(r)) FROM "Reaction" r),'siteCount',(SELECT count(*) FROM "SiteVisitor"),'eventCount',(SELECT count(*) FROM "SiteVisitEvent"));`);
  const before = snapshot();
  const originalUser = sql(database, `SELECT json_build_array(id,email,"passwordHash","createdAt","updatedAt") FROM "User" WHERE id = 'legacy-user'`);
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'pipe' });
  assert.equal(snapshot(), before);
  assert.equal(sql(database, `SELECT json_build_array(id,email,"passwordHash","createdAt","updatedAt") FROM "User" WHERE id = 'legacy-user'`), originalUser);
  assert.equal(sql(database, `SELECT "sessionVersion" FROM "User" WHERE id = 'legacy-user'`), '0');
  assert.equal(sql(database, `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'passwordHash'`), 'YES');
  assert.equal(sql(database, `SELECT count(*) FROM "Story" WHERE "deletedAt" IS NULL AND "publishKey" IS NULL`), '1');
  assert.equal(sql(database, `SELECT count(*) FROM "StoryView" WHERE "deviceModel" IS NULL AND "isAuthenticated" IS NULL`), '1');
  console.log('PASS: migrations preserve existing account/password data, stories, comments, reactions, views, read time, site visitors and events; legacy Google accounts can retain a NULL password hash.');
} finally {
  // Only the uniquely named temporary database created by this script is removed.
  if (created) sql('postgres', `DROP DATABASE "${database}"`);
  rmSync(temp, { recursive: true, force: true });
}
