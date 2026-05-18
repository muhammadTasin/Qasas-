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
- Node.js 18+
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
touch .env.local
```

Add your Supabase credentials to `.env.local`

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database
DIRECT_URL=postgresql://user:password@host:5432/database
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

### Running Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

### Prisma Migrations (Supabase)

If you encounter a cross-schema error with Supabase:

```bash
psql $DIRECT_URL -c "DROP TABLE IF EXISTS public.profiles CASCADE;"
npx prisma migrate dev
```

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

## License

MIT License. See LICENSE file for details.
