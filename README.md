# Qasas — Story Sharing Platform

A community platform for writing and reading stories with estimated read times and interactive engagement features.

Global Unique Voices uses authenticated account identities plus remaining anonymous visitors. See the [identity rules, regression results and migration operator guide](docs/global-unique-voices.md) before releasing this change.

---

## Overview

Qasas is a full-stack web application where users can publish stories, read stories from others, react with emotions (love, sorrow, anger), leave comments, and see how long each story takes to read. The platform tracks visitor engagement and story analytics.

---

## Problem It Solves

- Provides a focused, simple space for people to share personal stories
- Tracks reading engagement with time estimates
- Enables readers to interact through reactions and comments

---

## Key Features

- **User Authentication:** Email signup/login with password hashing (bcryptjs)
- **Story Publishing:** Create, read, update stories with rich metadata
- **Reactions System:** Users can react with LOVE, SORROW, or ANGRY emotions (one per user per story)
- **Comments:** Threaded comments on stories with cascade delete handling
- **Read Time Tracking:** Estimates reading time based on content length and tracks actual time spent
- **Analytics:** Per-story view tracking with device, browser, OS, and geolocation detection
- **Site Visitor Tracking:** Anonymous visitor analytics with IP hashing and user agent parsing

---

## Tech Stack

- **Frontend:** Next.js 16.1.4 (App Router), React 19.2.3, TypeScript, Tailwind CSS 4
- **Backend:** Next.js API routes, next-auth 4.24.11 for authentication
- **Database:** Supabase PostgreSQL with Prisma ORM (5.22.0)
- **Security:** bcryptjs for password hashing, zod for validation

---

## Architecture

```
Frontend (Next.js + React)
    ↓
Next.js API Routes + next-auth
    ↓
Prisma ORM
    ↓
Supabase PostgreSQL
```

**Data Flow:**
1. User authenticates via next-auth (email/password)
2. Story creation/retrieval goes through Next.js API routes
3. Reactions and comments stored in relational tables with proper indexing
4. Read time and visitor analytics tracked passively
5. All queries use Prisma for type safety

---

## Screenshots

*Screenshot placeholders:*
- [ ] Dashboard showing recent stories
- [ ] Story view with comments and reactions
- [ ] Story creation form

---

## Setup Instructions

### Prerequisites
- Node.js 20.9+
- npm or yarn
- Supabase account (PostgreSQL database)

### Installation

```bash
# Clone repository
git clone https://github.com/muhammadTasin/Qasas-.git
cd Qasas-

# Install dependencies
npm install

# Create a local environment file
touch .env
```

Add your Supabase credentials to `.env` (Prisma CLI reads this file too).

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database
DIRECT_URL=postgresql://user:password@host:5432/database
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
ANALYTICS_SALT=replace-with-a-stable-random-secret-of-at-least-32-characters
```

### Running Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

### Prisma migrations and deployment

Configure `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `ANALYTICS_SALT` in your deployment environment before running:

```bash
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run lint
npm run build
```

Run `prisma migrate deploy` against the intended database **before** serving the updated application. The pending migrations add compatibility tables, nullable columns and indexes and permit NULL password hashes; they preserve existing records. Do not use `migrate reset`, `db push --force-reset`, or destructive SQL. No deployment is performed by these commands. Deploy the verified commit through your usual Vercel workflow afterward. The build script regenerates Prisma Client so cached dependencies cannot leave it behind the schema.

For Supabase/Vercel, use the provider's transaction-pooler URL for `DATABASE_URL` (with the connection options required by your provider, such as `pgbouncer=true`) and a migration-capable direct or session-pooler URL for `DIRECT_URL`. Start with a small per-instance connection limit appropriate to your database plan; avoid a large default pool on every serverless instance. Prisma is reused within the warm process and is not disconnected after each request.

Generate `ANALYTICS_SALT` once with `openssl rand -hex 32`, store it as a server-only secret, and keep it stable. Do not use a `NEXT_PUBLIC_` prefix. Missing or fewer than 32 characters disables tracking with a generic 503 response; reading and story mutations do not depend on analytics. Changing this secret changes private labels and IP fallback identities. If an existing strong salt is configured, keep it.

### Visitor analytics and Trash

- Global statistics are shown only to signed-in users. The statistics API also requires authentication and sends `Cache-Control: private, no-store`.
- Story Insights is restricted to the active story's author. It returns sanitized display data, not raw visitor IDs, IP hashes, user agents, email addresses or authentication IDs.
- Browser identity uses a secure, HttpOnly, SameSite=Lax cookie with a one-year expiry. Logging in does not replace it. Clearing cookies or changing browsers creates a different visitor.
- Private labels combine a browser-supplied model (or truthful OS/device fallback) with a 12-character HMAC suffix. There is no device-model lookup table or fingerprinting. UA Client Hints are best effort; unavailable hints time out after 200 ms. Model, platform, architecture, browser brand and mobile/device-type hints are collected; late model hints are retained for later read-time batches.
- iPhone Safari usually exposes only “iPhone”; desktop browsers usually cannot expose a manufacturer/model. Reduced Android UAs may also lack a model. No hardware is inferred from screen dimensions.
- Location comes only from Vercel's network geo headers. Country codes are formatted using `Intl.DisplayNames`; unavailable cities/regions are not guessed. Subdivision codes use the static ISO 3166 dataset where a matching name exists; otherwise they remain explicitly labeled region codes. Outside Vercel, only trust geo headers injected by your own proxy. No GPS permission or coordinates are used.
- Story reader counts use each browser's **latest observed** authentication state and its server-session user link. Signed-in readers are combined across browsers; guests retain anonymous browser identity. Earlier rows without reliable identity remain separately labeled legacy records. Global site analytics retain their existing behavior.
- Story uniqueness remains enforced by the existing `(storyId, visitorId)` or IP-fallback unique keys. New views are available on the next Insights request. Story Insights returns at most 20 recent readers per category; unique counts and read totals cover all streams, combining signed-in users across browsers.
- Site statistics and the public story list have a 60-second data cache. Story create/edit/delete/restore immediately expire the list cache, with targeted route invalidation. Authentication-sensitive pages remain dynamically rendered.
- Tracking never blocks rendering/navigation. Read time is batched every 15 seconds while visible/recently active, capped at 20 minutes per mounted story. Requests are bounded to 4 KiB and 30 seconds per increment. A database gate coalesces duplicate read increments within 10 seconds and site events within 3 seconds, including across server instances. Actual guest/login transitions are retained even inside the event window. Very short final read-time flushes within the gate can be omitted. A bounded local throttle sheds repeat writes; use platform-level rate limits for deliberate distributed abuse.
- Normal Delete moves a story into database-backed Trash via `deletedAt`. The subtle **Trash** link is on **My stories** (`/me?trash=1`). Only its owner can restore it. There is no permanent-delete UI. Edit reuses the original route and updates the same record. Deleted stories are excluded from public reads and interaction/analytics writes.

### Verification

```bash
npm test
```

Database and browser suites deliberately refuse a non-local database or any database name other than `qasas_test`. Create a dedicated empty local test database and apply migrations to it first. Never point these tests at production.

```bash
export TEST_DATABASE_URL='postgresql://TEST_USER:TEST_PASSWORD@127.0.0.1:5432/qasas_test'
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm run test:integration
npm run test:migration
```

The migration suite requires the PostgreSQL `psql` CLI and a local role allowed to create temporary databases. It applies the old migrations, inserts marked fixtures, applies the additive migration, verifies preservation, and removes only its own temporary database.

For browser tests, configure `.env` with that same isolated test database, a test `NEXTAUTH_SECRET` and `ANALYTICS_SALT`, and `NEXTAUTH_URL=http://localhost:3000`. Then run:

```bash
npx playwright install chromium
npm run build
npm run start
# In a second terminal with TEST_DATABASE_URL and the same NEXTAUTH_SECRET exported:
npm run test:e2e
```

The browser suite signs up local test accounts and exercises owner/non-owner mutation requests, privacy, guest tracking, login continuity, Trash/Restore, comments, reactions, desktop/mobile layout, and analytics transport failure. `TEST_BROWSER_PATH` can optionally select an existing Chromium executable.

See [the implementation report](docs/implementation-report.md) for the full change list and validation results.

---

## Known Limitations

- No story categories or tagging yet (planned)
- No search or filtering functionality yet
- Read time estimation is simple (word count based)
- Geolocation detection is IP-based (not exact)
- No user profiles or profile pages
- No story recommendations or discovery algorithms

---

## Future Improvements

- [ ] Story categories and tags
- [ ] Search and advanced filters
- [ ] User profile pages and follower system
- [ ] Better read time algorithm (based on actual interaction)
- [ ] Story bookmarks/saved stories
- [ ] Email notifications for reactions and comments
- [ ] Social sharing features
- [ ] Content moderation tools

---



## Original Qasas and Journal themes

The default presentation now restores the polished deployment at https://qasas-web.vercel.app/ from its original `qasas2` source in commit `f214445`. The previous implementation retained the simplified root repository UI; that was a different presentation. The restoration uses the existing routes, database, authenticated actions and analytics, not the old backend.

The small moon/sun control switches between Original Qasas and Journal. A validated `qasas-theme` cookie is read during server rendering, so the selected theme is already in the first HTML response. The preference is also written to localStorage. No theme database fields, separate routes, duplicate data fetching or theme library are needed. Journal is based on the supplied black editorial reference; its Stitch project requires Google access and was not accessible to the verification browser. Existing stories have no cover field, so cards remain text-only rather than attaching invented images to stories.

## Existing Google accounts

Google sign-in remains available alongside email/password sign-in when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured. Use the existing client configuration and stable `NEXTAUTH_SECRET`. Set Google's authorized redirect URI to `NEXTAUTH_URL` followed by `/api/auth/callback/google`.

Google callbacks require a verified email and a subject matching the authenticated provider account. An existing Google `Account` link always retains its original Qasas `User`. If no link exists, a matching email connects Google to the existing user without changing their ID, name, password hash, or story ownership. A new email creates a Google-only user with no credentials password. Atomic writes and retries handle concurrent sign-ins without duplicate users or orphan records.

Password reset has been removed: there are no reset forms, routes, server actions, email delivery, reset tables, or session-version tracking. No email-provider configuration is required.

Google account compatibility is provided by `20260906120000_google_auth_compatibility`, which this Insights change leaves unchanged. It permits NULL password hashes and creates the original `Account` table only if absent, preserving existing users, passwords, provider links and stories. The already applied `20260905180000_private_analytics_and_story_trash` migration is unchanged. Apply pending migrations only when deployment is separately authorized.

The authentication regression suite checks verified email linking, unchanged credentials and story relationships, legacy Google accounts, rejected unverified profiles and concurrent callbacks. Browser tests use a synthetic verified Google result through the real authentication callbacks and signed session to verify access to existing stories in both themes. They do not contact Google's external OAuth service. Export the same local `NEXTAUTH_SECRET` used by the test server when running that suite.

See [the UI restoration report](docs/ui-restoration-report.md) for the changed files, comparison measurements, screenshots and validation results.

## Story Insights v2 and optional analytics reset

Insights now separates logged-in readers (with their Qasas display name) and anonymous guests, replaces Mobile % with unique-reader device counts, and preserves the most specific device information reported by the browser. Read times under one minute display seconds. Names and all Insights data remain restricted to the story owner on the server.

The additive migration `20260906180000_story_reader_analytics` adds a nullable Qasas user relation, optional architecture and indexes. It preserves all existing data and makes no attempt to identify old readers. The separate `scripts/reset-story-analytics.mjs` requires `CONFIRM_RESET_STORY_ANALYTICS=YES` and an explicit `DATABASE_URL`; it deletes only StoryView rows and zeroes Story read totals in one transaction. It never runs automatically and preserves global site analytics.

See [the complete Insights v2 review and operator guide](docs/story-insights-v2.md) for every changed file/schema field, the exact response shape, counting semantics, device/location limits, tests, migration commands and the separate optional production reset command. Production migration, deployment and reset require a later operator action after review.
