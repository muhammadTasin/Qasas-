# Global Unique Voices: operator report

Branch: `codex/fix-global-unique-voices`, based on freshly fetched `origin/main` at `1f7b4a8`. This is a targeted analytics fix. No production database was connected to, migrated or reset. No merge or application deployment is part of this work.

## Verified root cause

Latest main's `getSiteStats` used `prisma.siteVisitor.count()` for lifetime visitors and the same row count filtered by `lastSeenAt` for the last 30 days. `SiteVisitor` had unique anonymous `visitorId` / salted `ipHash` identities and an `isAuthenticated` flag, but no relation to `User`. `trackingContext` already obtained the authenticated Qasas ID for Story Insights; the site route discarded that ID. Every browser stream therefore increased the footer, regardless of the account using it. The footer also fetched stats only once per authentication state, so server revalidation alone could not refresh an already open page.

Before implementation, six integration cases ran against isolated PostgreSQL with the original counting implementation extracted unchanged into a directly testable module. Three failed:

| Case | Actual on main | Required |
| --- | --- | --- |
| One account on a second browser | 2 | 1 |
| Two accounts using five browser identities | 5 | 2 |
| Existing account plus guest phone, after phone login | 2 | 1 |

## Formula and minimal durable schema

**Old lifetime formula:** number of SiteVisitor rows.

**New lifetime formula:** number of User rows with `siteLastSeenAt IS NOT NULL` + number of SiteVisitor rows with `userId IS NULL`.

`User.id` is already a primary key, so the first term is exactly one per observed authenticated account. Unvisited registered accounts are not counted. The second term preserves genuinely anonymous identities and unreconciled legacy rows. Previously linked browsers are excluded from the guest term even after logout.

The last-30-days total counts distinct account IDs from recent authenticated markers or recent linked browser streams, plus recent unlinked anonymous streams. A returning linked browser may contribute to this aggregate after logout without updating the account's authenticated timestamp or attributing its guest events to that account. One SQL statement obtains all three aggregates from a consistent database snapshot. Distinct/count work stays in PostgreSQL; no device identities are downloaded for JavaScript deduplication and no per-visitor User lookup is introduced. Exact cold counts still cost work proportional to matching data; the shared cache amortizes that work.

Migration: `prisma/migrations/20260906200000_global_unique_voices/migration.sql`.

| Addition | Meaning |
| --- | --- |
| `SiteVisitor.userId TEXT NULL` | Last authenticated account observed on this browser stream, retained solely for counting reconciliation after logout. |
| `SiteVisitor.user`, `User.siteVisitors` | Prisma relation/inverse. FK `SiteVisitor_userId_fkey`: `ON DELETE SET NULL`, `ON UPDATE CASCADE`. |
| `User.siteLastSeenAt TIMESTAMP(3) NULL` | Most recent authenticated site visit, retained independently of subsequent browser/account switches. |
| `SiteVisitor_userId_lastSeenAt_idx` | B-tree on `(userId, lastSeenAt)` for relation and anonymous/recent filtering. |
| `User_siteLastSeenAt_idx` | B-tree on the authenticated visit marker. |

The account marker retains both A and B when one browser switches from A to B. Simply overwriting the browser link and counting distinct links would erase A if that was A's only browser. No extra identity-history table is needed. The marker uses an explicit UTC cast and `GREATEST`; it does not alter `User.updatedAt`, profile, password or authentication fields.

No applied migration is edited. Both columns are nullable without defaults: existing rows remain unlinked/unmarked. There is no forced backfill or application-data UPDATE/DELETE in the migration. Matching pre-existing objects are accepted. Incompatible column, index or FK definitions abort the transaction. Equivalent indexes/FKs with unexpected names require operator reconciliation instead of duplication. Lock acquisition is bounded at 5 seconds and each statement at 120 seconds. Indexes are built transactionally, not concurrently; plan a quiet window for large tables. A timeout rolls back schema changes and requires investigation before retrying.

## Identity, events and privacy

1. Guests reuse the existing persistent cookie or secure salted IP/User-Agent fallback. Different valid cookies are never merged by IP. No new fingerprinting or location collection is added.
2. The site route supplies only the server session's Qasas User.id. Body-supplied IDs, emails or authentication flags cannot establish identity. The tracking helper derives current authentication state from its trusted ID argument.
3. Authenticated tracking atomically links the browser and records the account marker. Guest → new account replaces one anonymous contribution with one account contribution. Guest → already counted account removes the extra anonymous contribution. Browser rows and events are preserved.
4. Logout updates current `isAuthenticated` and metadata while retaining the counting link. It does not update the account's authenticated timestamp. SiteVisitEvent still stores its existing anonymous suffix, path and current authentication flag; no event user relation is added. Never use the retained link to authorize requests or label anonymous activity with a person's name.
5. Account switching replaces the browser's link with the latest observed authenticated account while retaining earlier accounts' markers. Rapid A → guest → B → A observations are not suppressed by client/process-local site throttles. The existing database three-second gate still coalesces events independently of reconciliation. Story scopes retain their original throttles.
6. The browser upsert, account marker and event write share a transaction. Unique indexes, row locks and the User primary key enforce identity across tabs, processes and Vercel instances. Stats use one snapshot, avoiding half-reconciled counts. No process-local map is the source of truth.
7. The same account across unlimited browsers, devices, IPs, new cookies and future visits counts once after authentication. Unknown guests may temporarily add a voice until login provides evidence. Shared accounts still count as one account; unknown people sharing a browser, and cookie clearing while anonymous, cannot be perfectly resolved without more evidence.
8. `ON DELETE SET NULL` preserves visitor/event history after future account deletion. Former browser streams become anonymous legacy identities; multiple such streams can increase the guest count. No account-deletion feature is added here. This is a known limitation when the canonical account itself is removed.

Story Insights' latest-reader association/logout behavior, reader names, devices, read time, approximate location, owner checks and response remain unchanged. The only shared request-helper change bypasses the local throttle for the site scope; story scopes keep their existing behavior.

## Historical data and reset decision

Never infer historical User IDs from `isAuthenticated`, IP, device details, geography, emails or event suffixes. The previous site schema has no trustworthy account link. Old rows remain legacy anonymous identities. When the same cookie/fallback returns while authenticated, its existing row safely links to that account.

Lost-cookie test browsers or browsers that never return can remain extra legacy voices. This migration cannot truthfully promise that today's inflated production number immediately becomes an exact historical people count. Production contents were not inspected to assert otherwise.

**No reset is required for the fix, and no destructive reset script is added.** Keeping rows and reconciling authenticated returns preserves legitimate guests. A blanket reset cannot distinguish them from test devices and would discard both, so it is not the recommended repair. The read-only preflight exposes aggregate legacy states for assessment. No `CONFIRM_RESET_SITE_VISITORS=YES` command exists because this change provides no destructive reset operation. If a fresh baseline is later required despite that loss, it needs a separately reviewed reset of only SiteVisitor rows and User.siteLastSeenAt markers, preserving every SiteVisitEvent and all other User fields, Account, Story, StoryView, read totals, content, Comment and Reaction data. Nothing here performs or schedules that action.

## Cache and response

The API retains exactly three numeric properties: `uniqueVisitorsLifetime`, `uniqueVisitorsLast30Days`, `totalVisits`. Guests still receive 401; the footer follows the existing authenticated visibility rule. Responses keep `Cache-Control: private, no-store`. No names, emails, user IDs, visitor UUIDs, hashes, raw User-Agent, provider IDs or tokens are added.

The server uses `private-site-stats-people-v2`, a 30-second time bucket as a cache argument, and 30-second revalidation. New buckets cannot reuse the old formula or serve a prior bucket's result during background revalidation. The visible footer polls every 30 seconds, refreshes on visibility return, prevents overlapping fetches and aborts on cleanup. A completed reconciliation reaches a visible connected footer within approximately 60 seconds plus request latency. Offline/background pages refresh after returning. Tracking remains asynchronous after hydration and does not block page rendering.

This follows Next's documented [cache arguments and revalidation behavior](https://nextjs.org/docs/app/api-reference/functions/unstable_cache). Correctness does not depend on invalidation reaching every warm process: separate instances may each compute a bucket, but cannot retain older buckets indefinitely.

## Tests and evidence

Verification uses a newly initialized localhost PostgreSQL cluster on port 55439. Existing suites and the local production build use `qasas_test`; global-count, migration and reset suites create/drop uniquely named temporary local databases. No production data is used.

| Check | Result |
| --- | --- |
| Prisma validate / generate | Passed with Prisma 5.22.0. |
| Local migrate deploy / status | Six migrations applied; schema up to date. |
| Unit tests | 13 passed. |
| Integration tests | 41 passed: existing 24 plus 17 global-voice cases. |
| Migration tests | Both prior-schema scenarios passed, including old Google accounts, complete row preservation, NULL new fields, FK/index checks, replay and incompatible drift rollback. |
| TypeScript | Passed. |
| Lint | Zero errors; one pre-existing unused eslint-disable warning in `src/lib/prisma.ts`. |
| Production build | Passed. |
| Playwright/E2E | All 10 passed in 2.1 minutes against the local production build; the mounted footer reconciled within 60 seconds. |
| Database/schema comparison | `prisma migrate diff` reports no difference. |

The new database cases cover all ten requested count examples; 50 guest refreshes/navigation; salted fallback and different cookies on one IP; shared-browser switching; logout privacy and UTC accuracy; event preservation/independent growth; legacy NULL rows; 12 concurrent browser reconciliations; separate Node processes sharing only PostgreSQL; consistent concurrent reads; recent counts; deleted-user FK behavior; and 3,002 streams yielding 1,002 voices in a bounded aggregate response.

Browser tests exercise real server session decoding, spoofed payloads, PC/Android/iPhone contexts, rapid transitions, cleared cookies, guest denial, exact DTO/header rules and a mounted footer updating with the real production cache/timer. Existing regressions cover credentials signup/login, synthetic verified Google callback continuity, stories/comments/reactions/Edit/Delete/Trash/Restore, private reader/device/location/read-time Insights and both themes. The Google browser assertion allows only the new analytics timestamp to advance; User.id, passwords, profile and original timestamps remain exact. External Google OAuth exchange and hosted Vercel execution were not performed. Google tests use synthetic verified provider results with real signed sessions; multi-instance tests use independent local Node processes.

Exact verification commands (the ignored `.env` in this isolated worktree contains **only local test settings**, including TEST_DATABASE_URL, DATABASE_URL, DIRECT_URL, synthetic auth/analytics secrets and test Google provider settings):

```bash
node --env-file=.env node_modules/prisma/build/index.js validate
node --env-file=.env node_modules/prisma/build/index.js generate
node --env-file=.env node_modules/prisma/build/index.js migrate deploy
node --env-file=.env tests/migration.mjs
node --env-file=.env node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.mts
npx tsc --noEmit
npm run lint
npm run build
node --env-file=.env node_modules/prisma/build/index.js migrate status
node --env-file=.env node_modules/prisma/build/index.js migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
npm run start
# Separate terminal, while the local production build is serving:
TEST_BROWSER_PATH=/opt/google/chrome/chrome node --env-file=.env node_modules/@playwright/test/cli.js test
```

The combined tsx command runs the same files as `npm test` and `npm run test:integration`; `tests/migration.mjs` is `npm run test:migration`. The browser command is `npm run test:e2e` with the local browser executable and test environment. The read-only preflight SQL was also executed successfully against the local test database.

## Production preflight — operator only

These commands were not run against production. Use the reviewed release checkout, securely export the intended production `DATABASE_URL` and migration-capable `DIRECT_URL`, retain existing auth/analytics secrets, take a provider backup and choose a quiet window.

```bash
(
set -e
: "${DATABASE_URL:?Export the intended production application database URL}"
: "${DIRECT_URL:?Export the intended production direct or session-pooler URL}"
npm ci
npx prisma validate
)
```

Run status separately: pending migrations may return a nonzero exit code.

```bash
npx prisma migrate status
```

Expect the five existing migrations through `20260906180000_story_reader_analytics` to have finished, with only `20260906200000_global_unique_voices` pending. Stop on unexpected pending migrations, changed applied checksums, failures or divergent history. Do not blindly mark migrations applied, reset the database or use `db push` to bypass drift.

Use a libpq-compatible direct URL for psql, addressing the same database/schema as Prisma. Remove Prisma-only options (`schema`, `pgbouncer`, `connection_limit`) from that separate URL; if using a non-public schema, configure the same search_path. This script is read-only and reports schema definitions and aggregate counts, not identity values:

```bash
: "${PREFLIGHT_DATABASE_URL:?Export a libpq-compatible URL for that same direct database}"
psql "$PREFLIGHT_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/preflight-site-voices.sql
```

Review these exact expectations:

- User.id is the existing TEXT primary key. Existing Account/auth/story relationships match the five applied migrations.
- SiteVisitor retains its id, nullable visitorId/ipHash with individual unique indexes, metadata, timestamps and lastEventAt. SiteVisitEvent is independent and retained.
- Normally the two new columns are absent. If already present, require precisely nullable TEXT / TIMESTAMP(3), no defaults and reviewed genuine links. Every already-linked browser must refer to an account with a non-NULL marker. Resolve inconsistent partial data using evidence before release; this migration does not fabricate links or backfill markers.
- New index/FK names are absent or exactly match the definitions above. Investigate equivalent objects under different names, incompatible definitions, invalid indexes, orphan links or unexpected schemas before proceeding.
- Record aggregate browser/event counts and retain the backup. Historical authenticated flags without links are still legacy anonymous identities.
- Confirm alter/index privileges, available disk space, long-running transactions and index-build duration. Locks wait at most 5 seconds and each statement at most 120 seconds. If large tables cannot meet this window, plan a separately reviewed staged concurrent-index rollout instead of retrying repeatedly under load.

## Exact migration commands — after preflight and release approval

```bash
(
set -e
: "${DATABASE_URL:?Export the intended production application database URL}"
: "${DIRECT_URL:?Export the intended production direct or session-pooler URL}"
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
)
```

`migrate deploy` applies all pending migrations: preflight must establish that only the reviewed migration is pending. Apply schema before releasing the new app. For a failure, inspect rollback and Prisma's failed-migration record before changing history. An app rollback can leave these additive nullable columns and stored identities intact; no down migration or data deletion is needed.

Application deployment is a separate operator action. The branch includes `vercel.json` setting `git.deploymentEnabled["codex/fix-global-unique-voices"] = false`, preventing the requested push from triggering a preview deployment. Other branches keep their default behavior, per [Vercel's branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration).
