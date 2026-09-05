# Qasas implementation report

Implemented locally on `codex/performance-private-analytics`, based on `origin/main` commit `622f82a`. No commit was created, nothing was pushed, no website was deployed, and no production database was accessed. The repository UI is the source of truth, as requested; screenshot content was not recreated or hardcoded.

The loading problems found in the source were an uncached homepage query, broad author/comment/reaction reads, three uncached visitor counts in every main-layout render, duplicated counts in the public API, repeated session decoding, and sequential story/session reads. Tracking also had an instance-local read-time limiter, synchronous dynamic-route parameter access incompatible with Next.js 16, session-only visitor cookies, and no runtime device-model collection. Insights exposed raw database records. Normal Delete permanently cascaded through related records and only invalidated `/me`; Edit did not invalidate the homepage.

The homepage remains dynamic for authentication, while its public listing uses a 60-second data cache. The original homepage render structure is preserved, with no added empty Suspense fallback. Mutations immediately expire its tag and invalidate the affected routes. Statistics load after rendering, only for authenticated users, through a separate 60-second cache. The framework's immediate cache invalidation behavior is documented in [Next.js updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag). No production latency benchmark was performed; the performance conclusions are based on removed blocking work and verified local behavior.

The existing Edit route was reused. Server queries and atomic updates require the authenticated owner and an active story. Normal Delete sets `deletedAt`; Restore clears it on the same owner-owned record. Trash is the subtle link on My stories, at `/me?trash=1`. Deleted URLs and related interaction/tracking endpoints reject access. No permanent-delete UI was added. Comments, reactions, views, content, author, original ID, creation time and reading totals remain stored through Delete → Restore.

Visitor identity stays in the same year-long browser cookie through login. Story uniqueness uses the existing database constraints. New route events retain a private HMAC visitor key, pathname and server-derived authentication state. A real login/logout transition bypasses the short event-coalescing window. Private labels use the detected model (or truthful generic fallback) plus a 12-character HMAC suffix. Authenticated-user IDs are unnecessary and are not stored in the new analytics metadata. Legacy rows remain valid, with unknown historical authentication state rather than invented data.

Device information comes from the request UA, UA Client Hint headers and optional model/platform/mobile navigator hints. Unused architecture, bitness and platform-version hints are not requested. No model catalogue or viewport inference was added. iPhone Safari usually exposes only iPhone; desktop browsers usually cannot expose exact laptop manufacturers/models. Android hints may be unavailable too. See [MDN on high-entropy values](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/getHighEntropyValues). Location comes only from network geo headers; missing city/region values are never inferred. Country codes use the runtime internationalization API, while unresolvable region codes stay as supplied. There is no GPS permission request or coordinate storage. Only story owners see visitor labels/location.

Global counts are absent for logged-out users and `/api/site/stats` returns 401. Insights is owner-only and sends an explicit sanitized response without raw UUIDs, IP hashes, user agents, email addresses or authentication IDs. Data-dependent values come from requests, sessions, database records or supported runtime APIs. Searches of production source found none of the example phone models, cities, labels or analytics totals from the prompt.

The new migration is `prisma/migrations/20260905180000_private_analytics_and_story_trash/migration.sql`. It adds:

- `Story`: nullable `deletedAt` and unique nullable `publishKey`, plus the active/deleted creation-time index.
- `StoryView`: nullable `deviceModel`, `devicePlatform`, `isAuthenticated`, `lastReadAt`, plus the story/recency index.
- `SiteVisitor`: nullable `deviceModel`, `devicePlatform`, `isAuthenticated`, `lastEventAt`.
- `SiteVisitEvent`: nullable `pathname` and `isAuthenticated`.

Old migrations are unchanged. The migration has no DELETE, DROP TABLE, TRUNCATE or data-rewriting statements. Existing production data has not been touched; preservation was tested using pre-upgrade fixtures in an isolated PostgreSQL instance.

Before deployment, configure the intended `DATABASE_URL` and `DIRECT_URL`, existing NextAuth secrets/URL, and a stable server-only `ANALYTICS_SALT` of at least 32 characters. Generate a new salt only if needed with `openssl rand -hex 32`; keep an existing strong one stable. Then run:

```bash
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run lint
npm run build
```

The exact production migration command is `npx prisma migrate deploy`. Apply it before serving this code. The build script also regenerates Prisma Client. Deploy through the existing Vercel workflow when ready; no deployment was triggered here. Runtime pooled connections and migration connections should use the appropriate provider URLs described in README. An ignored local `.env` was created solely for the isolated local verification database; it is not a production configuration.

Verification results:

| Check | Result |
| --- | --- |
| Prisma validation | Passed |
| Prisma Client generation | Passed |
| ESLint | Passed, zero errors; one unchanged pre-existing unused-directive warning in `src/lib/prisma.ts` |
| Production build | Passed on Next.js 16.1.4; local parent-lockfile workspace-root warning only |
| TypeScript | Passed |
| Unit tests | 8 passed |
| PostgreSQL integration tests | 6 passed |
| Migration preservation test | Passed with pre-existing stories/comments/reactions/views/site visitors/events |
| Browser end-to-end tests | 2 passed, including the full multi-user flow and mobile layout |
| UI comparison | Repository fonts, CSS, navbar and glass-card styling preserved; desktop before/after and mobile screenshots inspected |
| Hardcoding/privacy audit | Production values are runtime-derived; examples occur only in marked test fixtures/documentation |

The browser flow verifies immediate pending state and one publish request, authenticated statistics, protected Insights, five guest refreshes, different anonymous suffixes for identical models, stable cookie identity after login, owner-only Edit/Delete/Restore with forged form IDs rejected, deleted public URLs returning 404, Trash surviving refresh and sign-out/sign-in, preserved comments/reactions/views after Restore, and reading/editing/deleting with analytics transport failures. Integration tests also verify concurrent increments and database reconnection. No real deployment or physical-device test was performed.

The preserved top-of-page desktop layout had no meaningful visual change; screenshot pixel differences above the footer were limited to 1–2 channel levels, consistent with rendering/background differences. Logged-out statistics are intentionally removed. The Insights table keeps its original appearance and scrolls horizontally at narrow widths.

Practical limits: network geolocation and browser-reported device metadata are approximate/self-reported. Existing cookie-less IP fallback can group browsers on the same network with identical UAs. Short repeated events are coalesced; a final read-time flush inside the 10-second gate can be omitted. The client batches visible/recently active reading every 15 seconds, with the existing 20-minute cap. Platform-level rate limits remain appropriate for deliberate distributed abuse. The unchanged framework dependency tree reports three high-severity npm audit findings (`next`, `postcss`, `sharp`); upgrading framework versions was kept outside this functional change.

Conservative scope audit against refreshed `origin/main` (`622f82a`): all original 47 changed/new files were reviewed. The final diff contains 44 files. The generated `next-env.d.ts` change, environment-specific `next.config.ts` override and unrelated `src/lib/prisma.ts` lint-comment cleanup were reverted. The build can regenerate its type reference locally; that mode-dependent output is not part of the final source diff.

Within retained files, dependency reordering, old-schema whitespace-only formatting, redundant removal of private-page dynamic declarations, an extra blank import line, automatic trimming of author-entered story/comment text, unused entropy hints, cosmetic device capitalization, and unsolicited empty-table copy were removed. The empty homepage Suspense boundary was removed; cached queries and the original complete-page JSX remain. README retains required Next.js compatibility, secrets, safe migrations and verification documentation, with the unrelated Node-version recommendation removed.

Runtime/build/migration files are required for the requested behavior. Verification files are `.gitignore`, `playwright.config.ts` and the four files under `tests/`; documentation files are `README.md` and this report. The lockfile is retained for reproducible builds and `npm ci`; runtime package versions are unchanged. No tests were removed. Production values remain runtime-derived; test fixtures are isolated from the application.

Remaining visible differences are limited to requested owner Delete/Trash/Restore controls and their pending/error states, removal of signed-out visitor totals, private analytics details/accuracy/privacy text, and replacing public email fallbacks with Anonymous. The original classes for existing UI elements are preserved except the Insights container changes from clipping overflow to horizontal scrolling so the requested long anonymous labels remain readable on mobile. Global CSS, fonts, navbar, page widths, original form/control sizes and public story-card styling are unchanged.

Exact files kept:

| File | Change |
| --- | --- |
| `.gitignore` | Ignore Playwright output and TypeScript incremental artifacts. |
| `README.md` | Document safe migrations, analytics behavior/limitations, database pooling, secrets, and reproducible verification. |
| `middleware.ts` | Issue/renew a one-year HttpOnly visitor cookie, forward it into the initial request, and request useful UA Client Hints. |
| `package.json` | Regenerate Prisma Client on build; add test scripts and missing type/test-only dependencies. Runtime framework versions retained. |
| `package-lock.json` | Lock dependencies for reproducible npm ci installations. |
| `playwright.config.ts` | Configure isolated desktop/mobile browser verification. |
| `prisma/schema.prisma` | Add soft deletion, publish idempotency, optional device/authentication metadata, route pathnames and persistent tracking gates/indexes. |
| `prisma/migrations/20260905180000_private_analytics_and_story_trash/migration.sql` | Add nullable columns and three indexes without rewriting old migrations or deleting rows. |
| `src/app/layout.tsx` | Use the render-scoped session helper to avoid repeated session decoding. |
| `src/app/(main)/layout.tsx` | Reuse the session helper and omit the visitor widget for logged-out users. |
| `src/app/(main)/page.tsx` | Remove force-dynamic override and use cached public story data while preserving the original JSX and render structure. |
| `src/app/(main)/me/page.tsx` | Select only list fields; add the existing-style Trash toggle and owner mutation forms. |
| `src/app/(main)/write/page.tsx` | Reuse the existing fields and styling with pending/error handling and idempotent publishing. |
| `src/app/(main)/stories/[id]/page.tsx` | Await Next.js route parameters, select only needed story/comment/reaction fields, read session concurrently, reject deleted stories, and add owner Delete. |
| `src/app/(main)/stories/[id]/edit/page.tsx` | Reuse the original edit route/form with awaited parameters, owner/active-story query filters, and pending/error handling. |
| `src/app/(main)/stories/[id]/insights/page.tsx` | Keep the Insights layout, authorize the active story's owner, show sanitized records/accurate totals and approximate-location wording. |
| `src/app/api/site/stats/route.ts` | Require authentication before cached counts; prohibit public HTTP caching and handle failures. |
| `src/app/api/site/visit/route.ts` | Validate bounded pathname/hint payloads and use resilient database-backed site tracking. |
| `src/app/api/stories/[id]/view/route.ts` | Await parameters, validate hints, and record a unique visitor only for an active story. |
| `src/app/api/stories/[id]/readtime/route.ts` | Await parameters, validate read-time batches, and use an atomic database gate. |
| `src/app/api/stories/[id]/insights/route.ts` | Enforce author authorization, reject deleted stories, return only sanitized display fields, and disable HTTP caching. |
| `src/components/MutationForm.tsx` | Shared immediate submission lock, pending button, recoverable error display, and client navigation after server success. |
| `src/components/CommentSection.tsx` | Accept minimal comment/user fields and avoid public email-address fallbacks. |
| `src/components/InsightsTable.tsx` | Render anonymous device labels, guest/login state, approximate locations and legacy fallbacks; allow horizontal scrolling on small screens. |
| `src/components/SiteStatsWidget.tsx` | Load the same statistics badges asynchronously only while authenticated; render no empty/error card. |
| `src/components/SiteVisitTracker.tsx` | Track pathname and authentication transitions without blocking navigation or remount duplicates. |
| `src/components/StoryCard.tsx` | Use the smaller cached story/author shape and avoid public email-address fallbacks; retain its styling. |
| `src/components/StoryEngagementTracker.tsx` | Collect best-effort hints, deduplicate views, batch active reading, and flush on hiding/unmounting with beacon/keepalive. |
| `src/lib/actions.ts` | Authenticate mutations, validate input, call atomic owner operations, invalidate only affected caches/routes, and check active-story availability for comments/reactions. |
| `src/lib/analytics.ts` | Normalize runtime UA/network data, validate cookie identity, require a strong salt, retain salted IP fallback, and generate private HMAC labels. |
| `src/lib/analytics-client.ts` | Collect optional UA Client Hints with a 200 ms fallback, deduplicate client tracking, and send non-blocking requests. |
| `src/lib/device-info.ts` | Shared model sanitization and truthful generic OS/device fallbacks, including reduced-UA placeholders. |
| `src/lib/session.ts` | Deduplicate getServerSession within a single server render, never across users. |
| `src/lib/site-stats.ts` | Share the three statistics queries through a 60-second server data cache. |
| `src/lib/story-data.ts` | Cache minimal active-story list data for 60 seconds with an immediately expirable tag. |
| `src/lib/story-insights.ts` | Aggregate all view rows and select only 20 recent rows; explicitly serialize safe private display fields. |
| `src/lib/story-mutations.ts` | Database-native idempotent publishing, atomic owner-scoped Edit/Delete/Restore, and transactional active-story guards. |
| `src/lib/tracking-request.ts` | Bound actual body bytes, validate hints/pathnames, reject cross-site browser writes, limit repeated requests, derive authentication server-side and contain errors. |
| `src/lib/tracking.ts` | Keep existing uniqueness constraints, preserve model metadata when hints are absent, persist route events/auth transitions and atomically coordinate read time. |
| `tests/analytics.test.ts` | Eight runtime device, privacy, location, identity and missing-secret tests using clearly marked fixtures. |
| `tests/integration.test.mts` | Six real PostgreSQL concurrency, ownership, tracking and Delete/Restore preservation tests. |
| `tests/migration.mjs` | Apply old and new migrations around legacy fixtures in a temporary local database and verify preservation. |
| `tests/e2e/qasas.spec.ts` | Real-browser auth, publishing, forged owner requests, comments/reactions, visitor continuity, private APIs, Trash/Restore, failure isolation and mobile checks. |
| `docs/implementation-report.md` | This complete implementation and verification handoff. |
