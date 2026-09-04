# University OS

**Your Academic Second Brain.**

University OS is an academic operating system — not a passive planner. It
follows one loop end to end:

**Capture → Organize → Learn → Practice → Identify Weaknesses → Review → Master**

Every screen exists to answer one question: *what should I do next, and why?*

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS v4** with a light/dark design-token system
- **Prisma + SQLite** (swap the datasource for Postgres/MySQL in production —
  the schema doesn't change)
- **Radix primitives** for accessible UI (dialogs, sheets, selects, tabs, popovers)
- **Recharts** for decision-oriented analytics, styled per a validated,
  colorblind-safe categorical palette
- **next-themes**, **cmdk** (global ⌘K search), **sonner** (toasts)

## Getting started

```bash
npm install
cp .env.example .env
npx prisma migrate dev   # creates prisma/dev.db and applies the schema
npm run db:seed          # rich demo data across every module
npm run dev
```

Open http://localhost:3000. The app resolves a single demo user
(`getCurrentUser()` in `src/lib/current-user.ts`) automatically — there's no
login flow, since University OS is designed as a personal, single-student
command center rather than a multi-tenant product.

### Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
npm run db:seed # re-seed (safe to re-run — it clears and rebuilds demo data)
```

## Architecture

### Data model (`prisma/schema.prisma`)

Every module in the spec is a real relation, not a mock: `User → Semester →
Subject → Topic → Lecture → LectureResource`, plus `KnowledgeGap`,
`Flashcard`, `ReviewItem`, `Problem`, `Mistake`, `ClinicalTraining`, `Video`,
`Task`, and `FocusSession`. **Knowledge gaps are the central intelligence
layer**: they carry optional foreign keys into lectures, topics, clinical
training entries, and videos, and flashcards/problems/mistakes/review items
all carry an optional `knowledgeGapId` back-reference — so resolving a gap,
grading a flashcard, or logging a mistake all stay connected to the same
underlying concept.

### Core logic (`src/lib`)

- `priority-engine.ts` — the Smart Priority Engine. Scores candidate actions
  (overdue flashcards, unresolved gaps weighted by connected mistakes,
  deadline urgency, overdue reviews, repeated mistakes) on a 0–100 scale and
  always returns a `reason` string.
- `academic-health.ts` — a weighted 0–100 score across completion, reviews,
  gaps, deadlines, and practice accuracy, with generated strengths/weaknesses.
- `spaced-repetition.ts` — a simplified SM-2 grader for flashcards (Again /
  Hard / Good / Easy) plus an urgency score used to order the due queue.
- `review-scheduler.ts` — creates the Day 1 / 3 / 7 / 14 / 30 review chain
  whenever a lecture is completed, a knowledge gap is resolved, or a problem
  is answered incorrectly.
- `mistake-patterns.ts` — detects repeated weaknesses by grouping open
  mistakes by topic and flagging any group past a threshold.
- `understanding-score.ts` — the per-lecture "Understanding: 78%" score,
  blended from knowledge gaps, practice accuracy, flashcard accuracy, and
  self-assessment.

### App structure (`src/app`)

Each spec module is a route: `/`, `/academics`, `/subjects/[id]`,
`/lectures/[id]`, `/knowledge-gaps`, `/flashcards`, `/review`, `/problems`,
`/mistakes`, `/clinical`, `/videos`, `/tasks`, `/calendar`, `/focus`,
`/analytics`. Mutations go through Server Actions in `src/app/actions/*`,
each calling `revalidatePath` so the UI reflects changes immediately. Pages
with "now"-relative logic (urgency, due-today, overdue) are marked
`export const dynamic = "force-dynamic"` so they never serve a stale
build-time snapshot.

Global affordances — Quick Capture and ⌘K search — live in
`src/components/shared` and are mounted once in the app shell
(`app-shell.tsx`), so they're available from any screen.

## Deployment & environment

University OS is a multi-user product: every account authenticates via
Supabase Auth, and all academic data is row-owned per user (see
`src/lib/authz.ts` and the RLS policies below). Deploying a new
environment needs:

**Environment variables** (see `.env.example`):

- `DATABASE_URL` — Postgres connection string. Prisma connects directly
  (not through PostgREST), so it needs the Supabase **Supavisor pooler**
  host (`aws-0-<region>.pooler.supabase.com:6543`) with
  `?pgbouncer=true&connection_limit=<N>` — the direct `db.<ref>.supabase.co`
  host is IPv6-only and unreachable from most serverless platforms.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used both
  server-side (Server Actions, the auth/session helpers in
  `src/lib/supabase/`) and client-side (the login/register forms). The
  anon/publishable key is intentionally not secret; every table and
  Storage object it can reach is gated by the RLS policies below, not by
  keeping the key hidden.

**Database**: apply `prisma/schema.prisma` to the target Postgres database
(this project applies migrations directly via the Supabase SQL editor/MCP
rather than `prisma migrate deploy`, since serverless sandboxes typically
can't open a raw TCP connection to Postgres — either approach works, the
schema is the source of truth either way). Then enable Row Level Security
on all tables with real per-user policies — see **Security model** below;
the policy SQL is not optional scaffolding, it's the boundary that stops
one user's data from being reachable by another through anything other
than this app's own Server Actions.

**Supabase Auth**: email/password sign-up is enabled by default on a new
Supabase project. If email confirmations are turned on (the default), a
new account must click the confirmation link before signing in — either
leave that on for a real deployment, or turn it off in the Supabase
dashboard (Authentication → Providers → Email) for a frictionless dev/demo
flow. `src/app/auth/callback/route.ts` handles the confirmation redirect
and is also where a future OAuth provider's callback would land — no
other code changes are needed to add one (Supabase Auth issues the same
kind of session either way).

**Storage**: a private Supabase Storage bucket named `lecture-slides`
holds uploaded lecture slide files, in per-user paths
(`<auth-user-id>/lectures/<lectureId>/...`). It needs the RLS policies in
**Security model** applied before uploads/downloads will work — without
them every Storage call is rejected, not silently public.

### Security model

- **Prisma bypasses RLS.** Prisma connects with the Postgres role that
  owns these tables, and Postgres does not apply RLS to a table's owning
  role. So RLS is *not* what stops one Server Action from reading another
  user's row — every Server Action does that itself, by resolving the
  authenticated user (`requireUserId()`) and either filtering queries by
  it directly or verifying a client-supplied id's ownership first (see
  `src/lib/authz.ts`). This is the primary, load-bearing boundary.
- **RLS is what protects the *other* access path**: Supabase's PostgREST
  API and Storage API, both reachable directly with the anon/publishable
  key, entirely outside this Next.js app. Every table has RLS enabled
  with policies keyed off the caller's `auth.uid()` (via
  `private.current_app_user_id()`, which maps a Supabase auth UUID to
  this app's Prisma `User.id`) — so even a request that bypasses the app
  completely still can't read or write another user's rows.
- **Storage policies** key off the object path itself
  (`(storage.foldername(name))[1] = auth.uid()::text`), and every
  upload/delete/signed-URL call runs as the requesting user (their access
  token is attached per-request — see `src/lib/supabase-storage.ts`), not
  as the bare anon role, so those policies actually apply.

## Design system

Tokens live in `src/app/globals.css` (OKLCH-based, light/dark pairs for every
role) and primitives in `src/components/ui` (a small, self-built
shadcn-style kit on top of Radix). Charts follow a validated, colorblind-safe
categorical/sequential/status palette (`src/lib/chart-colors.ts`) — subject
identity colors are reused from each subject's own `color` field so the
same hue means the same subject everywhere in the app.
