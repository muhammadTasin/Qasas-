# Story Insights v2 review and operator guide

Prepared on `codex/insights-v2-reader-analytics` from latest main at `6ba0d1b`. This work is for review in a PR to main. It does not deploy the app, merge the PR, run a production migration/reset, or modify production data.

## What was wrong and what changed

Story views were unique browser streams with a nullable authentication flag. They did not store the Qasas reader, so Insights could not reliably show a reader name or combine the same signed-in person across browsers. The panel mixed readers in one list, reported a mobile percentage, and rounded short reads to zero minutes.

Tracking now stores the server session's Qasas user on each browser stream, and PostgreSQL aggregates signed-in streams by user for the owner-only response. The panel separates logged-in readers, guests and any remaining legacy records; shows unique reader/device counts, named readers, specific reported device details, approximate location and short read times. The existing modal styling, theme tokens, scrolling and Escape behavior remain. Focus now returns to its launching button even after asynchronous loading temporarily disabled that button.

## Every schema change

New migration: `prisma/migrations/20260906180000_story_reader_analytics/migration.sql`.

- `StoryView.userId`: nullable `TEXT` / Prisma `String?`.
- `StoryView.user`: optional relation to `User.id`, foreign key `StoryView_userId_fkey`, `ON DELETE SET NULL`, `ON UPDATE CASCADE`.
- `User.storyViews`: inverse Prisma relation; it creates no extra database column.
- `StoryView.deviceArchitecture`: nullable `TEXT` / Prisma `String?` for exposed CPU architecture.
- Index `StoryView_storyId_userId_lastSeenAt_idx` on `(storyId, userId, lastSeenAt)`.
- Index `StoryView_userId_idx` on `(userId)` for the relation.

No existing unique constraint, column, row or applied migration is removed or rewritten. Existing rows receive NULL for both new columns. The migration does not infer readers from old analytics, backfill names, or reset any metrics.

## Identity and deduplication rules

1. The existing `(storyId, visitorId)` uniqueness, or salted IP fallback uniqueness when no valid cookie exists, continues to identify a browser stream. Refreshes reuse that row and its read-time gate.
2. Tracking determines `userId` exclusively from the authenticated server session. Browser-supplied user IDs or authentication flags are ignored. A new guest stream has `userId = null`, `isAuthenticated = false`; an authenticated stream has the Qasas user ID and `isAuthenticated = true`.
3. Streams currently associated with the same signed-in Qasas user count once per story, including across browsers. Read seconds are summed across those streams. Guests count by the existing anonymous stream identity.
4. Login, logout or account switching updates the same browser stream rather than creating an extra row for that transition. **This retains the existing latest-observed-state model:** the entire stream and its accumulated read time follow its latest observed user/guest state. It is not a historical log of time per account on a shared browser. Logout clears the stored user link; anonymous activity is never silently attributed to a previously signed-in account.
5. A known signed-in stream and a separate anonymous stream cannot be identified as the same person. Clearing cookies or using another browser anonymously can create another guest. No fingerprinting is added to try to connect them.
6. Each unique reader contributes one device count, based on the most recently seen stream (with a stable row-ID tie-break). Thus the four device counts sum to unique viewers; these are neither hits nor an inventory of physical devices.
7. The recent list contains up to 20 readers per category. Summary counts and read time cover all matching streams, regardless of list limits. Legacy NULL classifications or authenticated rows lacking a user link remain in an explicitly labeled earlier-readers section until reset or newly observed activity.

The existing client visibility/activity gate, 15-second batching, 30-second payload bound, 20-minute mounted-story cap and database 10-second repeat-write gate remain. Tracking still runs after hydration and never blocks public page rendering. Sub-minute durations show seconds; longer durations show minutes or hours/minutes.

## Device detail and limits

Exact directly exposed models/model codes are kept ahead of generic families. Sources include the existing UA parser, raw model tokens actually present in Android UA strings, `sec-ch-ua-model`, platform/mobile/architecture/browser headers, `navigator.userAgentData`, and supported `getHighEntropyValues` requests for model, platform and architecture. `navigator.platform` is only a fallback after the parsed OS. New generic or missing model hints cannot overwrite a previously stored exact model.

The 200 ms hint deadline keeps analytics non-blocking. If richer hints arrive afterward, the next existing read-time batch carries them. Rejected or unsupported APIs continue with available information. No entropy request loop, third-party fingerprinting service, GPU/screen inference or hardware lookup table is used.

A browser exposing only `iPhone` stays `iPhone`; an actual exposed model/code is displayed as supplied after length/control-character normalization. Desktop model names are preserved if explicitly reported, but ordinary browsers generally do not provide them: the standard model hint can be empty on desktop or when unknown. Architecture does not establish a laptop make/model. These are browser-reported details, not hardware attestation. See [the browser API documentation](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/getHighEntropyValues).

Device categories are Android phones/tablets, iPhone/iOS phone traffic, PC / Laptop for recognized desktop platforms, and Other for unsupported/uncertain categories (including iPad and TV/console/wearable types). OS, browser, architecture and exact device label remain separate fields.

## Location accuracy

Location uses the existing Vercel network city, subdivision and country headers. The output is City, Region, Country with duplicate names removed; missing fields are omitted, and wholly missing information becomes `Location unavailable`. Vercel documents these as location associated with the requester's network address. No additional geolocation request or service is added. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).

Country names come from `Intl.DisplayNames`. Subdivision codes are resolved using the static, server-side `iso-3166` 4.4.0 dataset, not a guessed local mapping. Unrecognized codes remain labeled as region codes. This translates a supplied region identifier; it does not establish a more precise location. See [the dataset source](https://github.com/wooorm/iso-3166).

City-level network estimates may be wrong because of VPNs, carrier gateways or ISP routing. Neither this application nor these headers establish a street, building, campus or precise physical position. Browser GPS/geolocation is never requested. The UI explicitly explains this limitation.

## Owner-only response shape

Both the API and the direct Insights page use the same service. Before fetching any reader names it checks the active story with `authorId === session.user.id`. The API returns 401 to guests and 404 to other users or for missing/deleted stories, with `Cache-Control: private, no-store`.

The service uses one ownership query and two database aggregation/list queries within a consistent read transaction. Reader names come from a single `User` join, not one query per reader. Sorting/grouping stays in PostgreSQL; no full history is downloaded into application memory. No public story query or homepage cache gains a names lookup.

This is a type description, not sample analytics:

```ts
{
  uniqueViewsCount: number;
  totalReadSeconds: number;
  loggedIn: number;
  guests: number;
  legacy: number;
  loggedInReadSeconds: number;
  guestReadSeconds: number;
  legacyReadSeconds: number;
  devices: {
    Android: number;
    iPhone: number;
    "PC / Laptop": number;
    Other: number;
  };
  recentLimitPerKind: number;
  viewers: Array<{
    displayName: string | null; // User.name or "Qasas user"; null for guests/legacy
    visitorLabel: string;      // device label + existing private HMAC suffix
    deviceModel: string;
    deviceCategory: "Android" | "iPhone" | "PC / Laptop" | "Other";
    deviceType: string | null;
    architecture: string | null;
    os: string | null;
    browser: string | null;
    approximateLocation: string;
    visitorKind: "Logged in" | "Guest" | "Legacy";
    totalReadSeconds: number;
    firstSeenAt: string;       // ISO date
    lastSeenAt: string;        // ISO date
  }>;
}
```

The allowlist response excludes User.email, database IDs, visitor UUIDs, raw hashes/IPs, raw User-Agent, provider IDs, tokens and internal grouping keys. Names are read from the current User record; a missing/blank name becomes `Qasas user`. Guest labels retain the existing salted anonymous approach.

## Validation and migration status

All database verification uses isolated localhost databases, including a separate temporary database for destructive-reset tests. The local test database reports all five migrations applied and its schema up to date. Production migration status was not queried or altered; the new migration is prepared for operator review, with production application still outstanding.

| Check | Result |
| --- | --- |
| Unit tests | 12 passed. |
| Integration tests | 24 passed, including existing Google/credentials continuity tests and the actual reset CLI against temporary fixtures. |
| Migration tests | Both scenarios passed, preserving existing users/accounts/stories/comments/reactions/views and site analytics, with NULL new fields and the expected indexes/FK. |
| Prisma validate / generate | Passed. |
| TypeScript | Standalone check and production build passed after the final correction. |
| Lint | Zero errors; one pre-existing unused eslint-disable warning in `src/lib/prisma.ts`. |
| Production build | Passed. |
| Browser suite | All 8 tests passed. Light and Journal screenshots were also visually reviewed at 390 px and 1,440 px. |

New integration coverage includes guest classification, server-actor precedence, cross-browser user deduplication, name/privacy DTO checks, owner denial, read-time concurrency and login transitions, device categories and exact model retention, legacy NULL rows, and summary accuracy for 1,050 streams / 1,025 unique readers while returning only 40 recent readers.

The reset test executes the real CLI: missing/wrong confirmation aborts; a simulated update failure rolls back the preceding delete; two confirmed runs preserve every user, story (including Trash), comment, reaction, account, SiteVisitor and SiteVisitEvent, including story timestamps and content.

Existing browser regressions cover credentials signup/login, Google callback session continuity, story creation/reading/editing, unauthorized mutation denial, Delete/Trash/Restore, comments/reactions, Light/Journal, theme persistence, private Unique Voices and tracking failures. Live external Google OAuth was not exchanged: Google callback tests use synthetic verified results and real signed sessions. The new browser flow checks forged user IDs, private names, cross-browser deduplication, exact model hints arriving after the deadline, absence of GPS calls and mobile/desktop dialog focus/scrolling.

## Production migration commands — operator only, after review

These commands were **not** run against production. First review/merge the PR, use the reviewed commit in your normal release checkout, and export the intended production `DATABASE_URL` and migration-capable `DIRECT_URL` securely in that shell. Keep the existing authentication and analytics secrets. Take your normal provider backup before schema changes. Do not paste credentials into Git, logs or this document.

From the reviewed repository checkout, install and validate first:

```bash
(
set -e
: "${DATABASE_URL:?Export the intended production app database URL}"
: "${DIRECT_URL:?Export the intended production direct/session-pooler URL}"
npm ci
npx prisma validate
)
```

Then inspect status as a separate preflight command. Prisma can return a nonzero exit code for pending migrations; the setup subshell above keeps its `set -e` from affecting this expected preflight result:

```bash
npx prisma migrate status
```

Confirm that the pending migration is `20260906180000_story_reader_analytics`; resolve any unexpected pending, failed or divergent migration history before proceeding. After reviewing the status, apply the additive migration:

```bash
set -e
: "${DATABASE_URL:?Export the intended production app database URL}"
: "${DIRECT_URL:?Export the intended production direct/session-pooler URL}"
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
```

`migrate deploy` applies pending database migrations; these commands do not deploy the application or reset analytics. Prisma generation is also retained in the existing build script. Deployment remains a separate, explicitly authorized operator action.

## Separate one-time story analytics reset — operator only

This script is never invoked by migrations, installation, build, application startup or tracking. If desired after review, preserve a backup/export of the existing StoryView rows and Story read totals. Use a brief quiet window for an exact fresh-start boundary: the script locks story writes during its transaction, but real visits can add fresh analytics immediately after it commits.

With the intended production migration-capable `DIRECT_URL` already exported:

```bash
set -e
: "${DIRECT_URL:?Export the intended production direct/session-pooler URL}"
CONFIRM_RESET_STORY_ANALYTICS=YES \
  DATABASE_URL="$DIRECT_URL" \
  node scripts/reset-story-analytics.mjs
```

It refuses to connect without exact `YES` confirmation and an explicit database URL. It prints a redacted target and the story count, StoryView count and total read seconds before deletion. One transaction locks Story then StoryView, deletes only StoryView rows and runs an update setting only `Story.totalReadSeconds = 0`; it preserves `Story.updatedAt`. It then prints remaining StoryView rows and the number of stories reset. Lock waits are bounded; any failure rolls the transaction back. Running it twice is safe. No permanent reset button or public endpoint was added.

The script does not delete or alter User, Story content/ownership/timestamps/Trash state, Comment, Reaction, Account, SiteVisitor, SiteVisitEvent or authentication data. Global Unique Voices/site analytics remain intact.

## Changed files

- `README.md`
- `docs/story-insights-v2.md`
- `middleware.ts`
- `package-lock.json`
- `package.json`
- `prisma/migrations/20260906180000_story_reader_analytics/migration.sql`
- `prisma/schema.prisma`
- `scripts/reset-story-analytics.mjs`
- `src/app/(main)/stories/[id]/insights/page.tsx`
- `src/app/api/stories/[id]/insights/route.ts`
- `src/app/api/stories/[id]/readtime/route.ts`
- `src/app/api/stories/[id]/view/route.ts`
- `src/components/InsightsLauncher.tsx`
- `src/components/InsightsPanel.tsx`
- `src/components/StoryEngagementTracker.tsx`
- `src/lib/analytics-client.ts`
- `src/lib/analytics.ts`
- `src/lib/device-info.ts`
- `src/lib/format.ts`
- `src/lib/story-insights.ts`
- `src/lib/tracking-request.ts`
- `src/lib/tracking.ts`
- `tests/analytics.test.ts`
- `tests/e2e/qasas.spec.ts`
- `tests/integration.test.mts`
- `tests/migration.mjs`
- `tests/reader-analytics.integration.test.mts`
- `tests/story-analytics-reset.test.mts`

The pre-existing generated `next-env.d.ts` modification is preserved outside this task's commits. Light/Journal CSS, public page designs, auth implementation and previously applied migrations are unchanged.
