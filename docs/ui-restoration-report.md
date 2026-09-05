# Original Qasas restoration and Journal theme

Completed locally on `codex/restore-qasas-ui-and-journal-theme`, compared with `origin/main` at `dc0ba9d`. The working tree contains 50 changed/new files: 49 for this work and the pre-existing `.gitignore` addition. No commit, push, merge or deployment was performed. Database verification used only dedicated localhost test databases.

## Why the previous UI differed

The repository contained two different Qasas presentations historically. The root application on main was the simplified interface. The polished live application was in `qasas2` at commit `f214445`; that directory was later removed by `cce7533`. The earlier functionality work preserved the root application, following the then-current instruction to treat main as the UI authority. It therefore did not reproduce the polished deployment. This correction recovers the actual old presentation source instead of inventing a screenshot-based replacement.

## Original Light restored

The recovered JSX/classes and CSS were adapted to the current application: Inter/Merriweather, cream/green animated background, floating desktop navbar, mobile bottom dock, Qasas hero and Bengali tagline, Recent Stories heading, two-column cards, read-time/reaction metadata, glass footer, reading surface, editor and Insights modal. Original branding copy was retained. Tailwind 3 color/font/shadow values were translated into the existing Tailwind 4 setup; responsive line-height precedence was corrected after measuring the live page.

Necessary visible additions are the subtle theme control, My Stories access, Edit/soft Delete/Trash/Restore controls, accurate private analytics fields, and credentials/password-reset forms. The theme button sits just outside the navbar without changing its original measured bounds. The live sign-in card was Google-only; retaining credentials and adding reset necessarily makes the form taller. Numeric Unique Voices is intentionally hidden when logged out and comes from the protected database count when logged in.

There are no blank loading cards on the homepage. It renders the cached real story list on the server, with a real empty-state message only when no active stories exist. The 60-second tagged listing cache, parallel story/session reads, cached authenticated visitor count and non-blocking analytics transport remain. The full route remains dynamically rendered for session/theme cookies; the shared story query is cached. Cold-cache database latency still affects the first story-list render.

## Journal and shared functionality

`html[data-theme="qasas"]` is the default. The optional `journal` value applies scoped CSS variables and layout overrides to the same components, routes and data. A one-year cookie supplies the theme in the initial server response; localStorage also records the choice. No theme library, theme database column, duplicated page tree or extra story request was added.

Journal uses near-black surfaces, warm text, bronze accents, restrained grain, thin dividers, serif article reading and a staggered editorial homepage. The latest real story receives the featured treatment. Existing stories have no image field, so they remain text-only; no story images or sample Stitch stories were invented.

The Stitch project required Google sign-in in the available browser. Its private source could not be inspected. Journal follows the supplied screenshot and written direction; it is not claimed to be a pixel-exact reconstruction of the inaccessible project.

Both themes share PostgreSQL stories, credentials/Google authentication, comments, reactions, cached listing, stable anonymous visitor cookies, runtime device hints, approximate network location, reading-time tracking and owner-only sanitized Insights. Existing authorization and Next.js 16 compatibility remain. Soft Delete keeps the original row and related records; Restore keeps the original ID, content, dates, comments, reactions and views. Complete browser flows exercised these operations in each theme, including denial of another author's requests and continued editing when analytics requests fail.

## Password reset and Google compatibility

Forgot Password is functional in code and was verified through the database and browser. It generates a random 32-byte secret, stores only its SHA-256 digest, expires it after 30 minutes, and atomically consumes it once while updating the bcrypt password. Reset increments a session version; previous JWT sessions lose authenticated access on their next request. The form requires matching passwords and respects bcrypt's 72-byte limit.

Every reset request returns the same generic message. Account lookup/delivery runs through Next.js `after()`. Database-backed email/network limits store HMAC subjects, not raw addresses. The reset origin comes only from `NEXTAUTH_URL`; production requires HTTPS. Tokens are carried in the email URL fragment, then submitted in the form body, keeping them out of request URLs and referrer headers. Delivery failure removes its pending token without logging it.

The real email adapter uses Resend through native `fetch`. **Actual email delivery still requires configuration**; no provider key or verified sender was available locally. Tests captured delivery with an injected test transport, and browser tests exercised one-time reset and subsequent sign-in. No real messages were sent. External Google OAuth was not exercised without credentials; tests verify reuse of existing provider links, compatibility with legacy NULL password hashes and refusal to silently link by matching email.

| Environment variable | Requirement |
| --- | --- |
| `RESEND_API_KEY` | New; server-only Resend sending key. |
| `PASSWORD_RESET_FROM` | New; sender on a verified Resend domain. |
| `NEXTAUTH_URL` | Existing canonical application origin; used to construct reset URLs. |
| `NEXTAUTH_SECRET` | Existing stable auth secret; also hashes reset rate-limit subjects. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional original Google configuration; both enable the provider/button. Authorized redirect URI is the application origin plus `/api/auth/callback/google`. |

The new forward migration is `20260906120000_password_reset_and_auth_compatibility`. It adds reset-token/rate-limit tables, `User.sessionVersion`, and the original `Account` table if absent. It also relaxes the password-hash NOT NULL constraint for legacy Google-only accounts, preserving existing hashes. No existing data/columns are deleted. The already-applied `20260905180000_private_analytics_and_story_trash` migration is byte-for-byte unchanged. Apply the new migration before serving this version when deployment is separately authorized; it has not been applied to production here.

## Visual verification

Live-source comparison used desktop 1440×1000 and mobile 390×844. Final fixture screenshots use widths 1440 and 390 with a 1000px viewport height. Additional responsive/theme checks ran at 768px. All screenshots use synthetic local database fixtures, so story text, total page height and data-dependent card heights differ from the live dataset.

| Light element | Live and restored measurements |
| --- | --- |
| Desktop guest navbar | x 556.453125, y 24, width 327.09375, height 58; 6px padding. |
| Desktop hero | x 384, y 288, width 672; Merriweather 72px / 72px line height. |
| Desktop Bengali tagline | y 384; 24px / 32px line height. |
| Desktop feed | x 232, y 600, width 976. |
| Mobile dock | x 86, y 738, width 218, height 82 at 390×844. |
| Mobile hero/tagline/feed | Hero y 168 at 48px / 60px; tagline y 252 at 20px / 32.5px; feed y 501. |
| Story cards | Desktop width 472, mobile 358; 32px padding and radius. Titles 24px / 28.8px Merriweather. |
| Footer glass panel | Desktop width 672, mobile 358; 40px padding and radius. |

Measured positions, typography and colors match for the selected navbar/hero/tagline/feed elements. Card and footer widths, padding, radii and typography match. Full-page pixel identity is not claimed: real content/auth state affects height, the original blobs animate, and the requested controls/privacy changes are visible. Live private My Stories was unavailable and has no recovered counterpart; its existing functionality was retained using the recovered visual tokens. Insights was compared with recovered source and the supplied private screenshot. Journal was visually reviewed against the supplied reference. No horizontal overflow was found on the checked pages, including mobile Insights.

Local screenshot evidence:

| Page | Original Light | Journal |
| --- | --- | --- |
| Desktop home | [Light](/tmp/qasas-ui-restore/final/qasas-home-1440.png) | [Journal](/tmp/qasas-ui-restore/final/journal-home-1440.png) |
| Mobile home | [Light](/tmp/qasas-ui-restore/final/qasas-home-390.png) | [Journal](/tmp/qasas-ui-restore/final/journal-home-390.png) |
| Desktop sign-in | [Light](/tmp/qasas-ui-restore/final/qasas-signin-1440.png) | [Journal](/tmp/qasas-ui-restore/final/journal-signin-1440.png) |
| Mobile sign-in | [Light](/tmp/qasas-ui-restore/final/qasas-signin-390.png) | [Journal](/tmp/qasas-ui-restore/final/journal-signin-390.png) |
| Desktop story | [Light](/tmp/qasas-ui-restore/final/qasas-story-1440.png) | [Journal](/tmp/qasas-ui-restore/final/journal-story-1440.png) |
| Mobile story | [Light](/tmp/qasas-ui-restore/final/qasas-story-390.png) | [Journal](/tmp/qasas-ui-restore/final/journal-story-390.png) |
| Desktop My Stories | [Light](/tmp/qasas-ui-restore/final/qasas-me-1440.png) | [Journal](/tmp/qasas-ui-restore/final/journal-me-1440.png) |
| Mobile My Stories | [Light](/tmp/qasas-ui-restore/final/qasas-me-390.png) | [Journal](/tmp/qasas-ui-restore/final/journal-me-390.png) |
| Desktop Insights | [Light](/tmp/qasas-ui-restore/final/qasas-insights-1440.png) | [Journal](/tmp/qasas-ui-restore/final/journal-insights-1440.png) |
| Mobile Insights | [Light](/tmp/qasas-ui-restore/final/qasas-insights-390.png) | [Journal](/tmp/qasas-ui-restore/final/journal-insights-390.png) |
| Mobile footer | [Light](/tmp/qasas-ui-restore/final/qasas-footer-390.png) | [Journal](/tmp/qasas-ui-restore/final/journal-footer-390.png) |

Reference captures: [desktop live home](/tmp/qasas-ui-restore/reference/home-desktop.png), [mobile live home](/tmp/qasas-ui-restore/reference/home-mobile-viewport.png), [live sign-in](/tmp/qasas-ui-restore/reference/signin.png), [live story](/tmp/qasas-ui-restore/reference/story.png). Measurements: [live desktop](/tmp/qasas-ui-restore/reference/desktop-metrics.json), [live mobile](/tmp/qasas-ui-restore/reference/mobile-metrics.json), [restored desktop](/tmp/qasas-ui-restore/final-desktop-metrics.json), [restored mobile](/tmp/qasas-ui-restore/final-mobile-metrics.json), [local fixture cards/footer](/tmp/qasas-ui-restore/final/local-metrics.json). These are local review artifacts, not production assets.

## Final checks

| Check | Result |
| --- | --- |
| `npx prisma validate` | Passed. |
| `npx prisma generate` | Passed, Prisma 5.22.0. |
| `npm run lint` | Passed with zero errors; one pre-existing unused eslint-disable warning in `src/lib/prisma.ts`. |
| `npm run build` | Passed, Next.js 16.1.4, including TypeScript. Local parent-lockfile workspace-root warning remains; no project configuration was changed just to suppress it. |
| `npm test` | 10 passed. |
| `npm run test:integration` | 10 passed against dedicated localhost PostgreSQL. |
| `npm run test:migration` | Passed; original account/password data and story/analytics relationships preserved. |
| `npm run test:e2e` | 6 passed against the final production build, including both themes, privacy/authorization, theme persistence/SSR, reset and desktop/mobile screenshots. |
| Fresh browser preview | Content/navigation rendered; no page errors or framework overlay. |
| Diff checks | No whitespace errors; applied analytics/Trash migration unchanged. |

## Exact file inventory and scope

All paths below are repository-relative. Runtime/configuration files are distinct from tests and documentation. No previous tests were removed. The generated `next-env.d.ts` change was reverted to `origin/main`; package dependency reordering was removed. `next.config.ts` is unchanged. `package-lock.json` only records the restored icon dependency. The old unused simplified components were left untouched rather than creating unrelated deletions.

| Purpose | Files |
| --- | --- |
| Shared shell and themes | `src/app/layout.tsx`, `src/app/globals.css`, `src/app/journal.css` (new), `src/app/(main)/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/components/SiteLayout.tsx` (new), `src/components/ThemeToggle.tsx` (new), `src/components/SiteStatsWidget.tsx` |
| Home and story presentation | `src/app/(main)/page.tsx`, `src/app/(main)/stories/[id]/page.tsx`, `src/components/StoryCard.tsx`, `src/components/CommentSection.tsx`, `src/components/ReactionPills.tsx` |
| Editor, owner controls, Trash/Restore | `src/app/(main)/write/page.tsx`, `src/app/(main)/stories/[id]/edit/page.tsx`, `src/app/(main)/me/page.tsx`, `src/components/StoryEditor.tsx` (new), `src/components/MutationForm.tsx` |
| Private Insights presentation | `src/app/(main)/stories/[id]/insights/page.tsx`, `src/components/InsightsLauncher.tsx` (new), `src/components/InsightsPanel.tsx` (new), `src/components/InsightsRoute.tsx` (new) |
| Authentication/reset presentation | `src/app/(auth)/signin/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/forgot-password/page.tsx` (new), `src/app/(auth)/reset-password/page.tsx` (new), `src/components/AuthShell.tsx` (new), `src/components/GoogleSignIn.tsx` (new), `src/components/SignInForm.tsx`, `src/components/PasswordResetForm.tsx` (new) |
| Shared runtime data | `src/lib/story-data.ts` (real card reaction counts), `src/lib/actions.ts` (reaction/list invalidation), `src/lib/story-insights.ts` (accurate guest/logged-in reading totals) |
| Authentication/reset backend | `src/lib/auth.ts`, `src/lib/google-auth.ts` (new), `src/lib/password-reset.ts` (new), `src/lib/password-reset-actions.ts` (new) |
| Schema compatibility | `prisma/schema.prisma`, `prisma/migrations/20260906120000_password_reset_and_auth_compatibility/migration.sql` (new) |
| Necessary dependency/test commands | `package.json`, `package-lock.json`; only new runtime dependency is `lucide-react`, the recovered UI's icon library. |
| Verification | `tests/e2e/qasas.spec.ts`, `tests/e2e/visual.spec.ts` (new), `tests/password-reset.test.ts` (new), `tests/password-reset.integration.test.mts` (new), `tests/migration.mjs` |
| Documentation | `README.md`, `docs/implementation-report.md` (historical-report pointer), `docs/ui-restoration-report.md` (new) |
| Pre-existing user change preserved | `.gitignore` (`.vercel` entry); not introduced by this restoration. |

No production stories, authors, dates, analytics counts, device models, locations, visitor IDs, reaction counts or reset tokens were hardcoded. Fixed branding, style tokens and clearly isolated test fixtures are the only reference/test literals. Both themes use the same runtime data and authorization. Nothing was committed, pushed, merged or deployed, and production database content was not modified.
