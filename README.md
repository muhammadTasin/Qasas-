Qasas is a storytelling website where anyone can share stories and read stories from others. The name is inspired by Surah Al-Qasas in the Qur'an, which means "The Stories." I chose it because the word relates to narrating events and storytelling.

## Why I Built This
I wanted a simple, focused place for people to tell their stories. Qasas is meant to make sharing easy, encourage reading, and highlight how much time it takes to read each story.

## Features
- Share your own stories
- Read stories from others
- See total read time for each story

## Tech Stack
- Next.js (App Router)
- TypeScript
- Prisma
- Supabase

## Roadmap
- Story categories and tags
- Search and filters
- Better discovery and recommendations
- Reader profiles and bookmarks

## Getting Started
Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit.

## Prisma Migrations (Supabase)
If you see a cross-schema error from Supabase (`public.profiles` referencing `auth.users`), drop the default `profiles` table and retry the migration:

```bash
psql $DIRECT_URL -c "DROP TABLE IF EXISTS public.profiles CASCADE;"
npx prisma migrate dev
```

## Security / Secrets (Important)
Even if the repository is private, never upload secrets:
- `.env`
- API keys
- Database passwords

Make sure `.gitignore` includes:
```
.env
.env.local
```

## Copyright / Usage
© 2026 MuhammadTasin. All rights reserved.

This project is proprietary. You may not copy, reproduce, or reuse the code or design
without written permission.
