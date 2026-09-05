# Qasas — Story Sharing Platform

A community platform for writing and reading stories with estimated read times and interactive engagement features.

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

Run `prisma migrate deploy` against the intended database **before** serving the updated application. The new migration only adds nullable columns and indexes; it preserves existing records. Do not use `migrate reset`, `db push --force-reset`, or destructive SQL. No deployment is performed by these commands. Deploy the verified commit through your usual Vercel workflow afterward. The build script regenerates Prisma Client so cached dependencies cannot leave it behind the schema.

For Supabase/Vercel, use the provider's transaction-pooler URL for `DATABASE_URL` (with the connection options required by your provider, such as `pgbouncer=true`) and a migration-capable direct or session-pooler URL for `DIRECT_URL`. Start with a small per-instance connection limit appropriate to your database plan; avoid a large default pool on every serverless instance. Prisma is reused within the warm process and is not disconnected after each request.

Generate `ANALYTICS_SALT` once with `openssl rand -hex 32`, store it as a server-only secret, and keep it stable. Do not use a `NEXT_PUBLIC_` prefix. Missing or fewer than 32 characters disables tracking with a generic 503 response; reading and story mutations do not depend on analytics. Changing this secret changes private labels and IP fallback identities. If an existing strong salt is configured, keep it.

### Visitor analytics and Trash

- Global statistics are shown only to signed-in users. The statistics API also requires authentication and sends `Cache-Control: private, no-store`.
- Story Insights is restricted to the active story's author. It returns sanitized display data, not raw visitor IDs, IP hashes, user agents, email addresses or authentication IDs.
- Browser identity uses a secure, HttpOnly, SameSite=Lax cookie with a one-year expiry. Logging in does not replace it. Clearing cookies or changing browsers creates a different visitor.
- Private labels combine a browser-supplied model (or truthful OS/device fallback) with a 12-character HMAC suffix. There is no device-model lookup table or fingerprinting. UA Client Hints are best effort; unavailable hints time out after 200 ms. Only model, platform and mobile/device-type hints are collected.
- iPhone Safari usually exposes only “iPhone”; desktop browsers usually cannot expose a manufacturer/model. Reduced Android UAs may also lack a model. No hardware is inferred from screen dimensions.
- Location comes only from Vercel's network geo headers. Country codes are formatted using `Intl.DisplayNames`; unavailable cities/regions are not guessed. Region codes remain as supplied when no authoritative name is available. Outside Vercel, only trust geo headers injected by your own proxy. No GPS permission or coordinates are used.
- Guest/logged-in visitor counts represent each browser's **latest observed** authentication state. Earlier records with no known state are marked as legacy/unknown. Route events preserve the state at the event time. No account ID is needed for this distinction.
- Story uniqueness remains enforced by the existing `(storyId, visitorId)` or IP-fallback unique keys. New views are available on the next Insights request. At most 20 recent visitors are loaded; totals are aggregated across all rows.
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
# In a second terminal with TEST_DATABASE_URL exported:
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

## Password reset and existing Google accounts

Forgot password is available from `/signin` in both themes. Requests always return the same generic message. Work is scheduled with Next.js `after()` so account lookup and email delivery do not change the visible response timing. Configure these **server-only** variables before enabling delivery:

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | API key from Resend, with permission to send email. |
| `PASSWORD_RESET_FROM` | A sender address on your verified Resend domain. |
| `NEXTAUTH_URL` | Existing canonical application origin, HTTPS in production. Reset URLs are derived only from this setting, never request Host headers. |
| `NEXTAUTH_SECRET` | Existing stable auth secret, also used to hash rate-limit subjects. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional existing Google OAuth configuration. When both are present, the original Google button/provider is available alongside credentials. |

Resend requires a verified sender/domain ([sending API](https://resend.com/docs/api-reference/emails/send-email)). This implementation uses native `fetch`; no email SDK or template library was added. Set the Google authorized redirect URI to your configured application origin followed by `/api/auth/callback/google`. Retain the existing `NEXTAUTH_SECRET` and original Google client configuration when continuing an existing deployment.

Reset tokens contain 32 cryptographically random bytes. Only SHA-256 digests are stored, with 30-minute expiry and one active token per account. Successful consumption and password update occur in one transaction; concurrent reuse cannot succeed. Passwords use the existing bcrypt cost of 12 and respect bcrypt's 72-byte input limit. A session version increments on reset so previously issued JWT sessions lose access on their next authenticated request. Tokens travel in the email link's URL fragment, which is absent from request URLs/referrer headers, and are submitted only in the reset form body. Used tokens are deleted; expired tokens are rejected and cleaned during subsequent requests. Failed email delivery removes its pending token and logs no email address or token.

Database-backed limits apply equally to registered and unknown email addresses: one request per email per minute and ten per network per hour. Subjects are HMAC hashes rather than stored email/IP addresses. Platform rate limiting is still appropriate for distributed abuse. Responses follow the [OWASP password-reset guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Apply the **new** migration `20260906120000_password_reset_and_auth_compatibility` before serving this version, using `npx prisma migrate deploy`. It adds reset-token and rate-limit tables, a session-version column, and an `Account` table only if it is absent. It also permits NULL password hashes for the original Google-only accounts, without changing existing hashes or removing any columns. Existing Google Account links are reused and are never relinked just because an email matches another account. Prisma tolerates a missing password hash on legacy Google users; newly created accounts still supply a bcrypt hash. The already applied `20260905180000_private_analytics_and_story_trash` migration is unchanged. No existing columns or account/story/analytics data are removed.

Without email configuration, the request page still returns the required generic response, but no email can be delivered. Delivery configuration failures are reported only in server logs. Local tests exercise the mail adapter with synthetic recipients and an injected capture transport; no real reset emails or production password changes are performed during verification.

See [the UI restoration report](docs/ui-restoration-report.md) for the exact files, comparison measurements, screenshots and validation results.
