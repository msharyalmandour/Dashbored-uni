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
`src/lib/authz.ts` and the RLS policies below). **Vercel is the current
deployment target** (native Next.js support, zero framework config
needed); the app was originally deployed on Netlify and that
configuration (`netlify.toml`, `netlify/functions/`) is still present
and functional as a rollback path — see **Netlify (legacy)** below.
Supabase (Postgres, Auth, Storage) is unchanged by which platform hosts
the Next.js app; nothing about the database, auth, or storage
architecture is provider-specific.

Deploying a new environment needs:

**Environment variables** (see `.env.example`):

- `DATABASE_URL` — the connection every request goes through. Prisma talks
  to Postgres directly (not through PostgREST), so this must be the
  Supabase **transaction pooler** on port 6543, with `?pgbouncer=true`.
  Copy it from the Supabase dashboard under Connect → Transaction pooler
  rather than assembling the host by hand; the region and pooler
  generation vary per project.

  This is the single largest lever on how fast the app feels. A serverless
  function that starts cold has no warm Postgres connection, so against
  the direct `db.<ref>.supabase.co:5432` host every first query in an
  invocation pays a fresh TCP handshake, a TLS handshake and Postgres
  startup before any SQL runs. Every concurrent invocation also holds a
  real backend connection, so the project's connection ceiling is reached
  under quite ordinary traffic and further requests queue. That host is
  IPv6-only besides, and unreachable from most serverless platforms. If
  navigation feels sluggish in a deployed environment, check this value
  first: a `DATABASE_URL` on port 5432 is the cause far more often than
  anything in the React tree.

  `pgbouncer=true` is not optional. The transaction pooler gives each
  statement a different backend connection, so Prisma has to stop relying
  on server-side prepared statements; without the flag you get
  intermittent "prepared statement already exists" failures under
  concurrency.

  Keep `connection_limit` small. It applies per function instance and
  Vercel runs many at once, so the pooler sees it multiplied by
  concurrency; `1` is Prisma's standard recommendation for serverless
  behind an external pooler. Several pages here fire about five queries
  through `Promise.all`, which a limit of 1 serialises — if that shows up
  as latency and the pooler has client headroom, 3 is a reasonable ceiling
  to try. Double-digit values are what exhaust the pooler under real
  traffic.
- `DIRECT_URL` — read only by Prisma's schema tooling (`migrate`,
  `db pull`, `studio`), never by the running app and never on a request
  path. Those commands need a session-mode connection, which the
  transaction pooler cannot provide. Use the dashboard's **session pooler**
  string (the pooler host on port 5432): it is session-mode as required,
  and unlike the direct host it is reachable over IPv4, so it also works
  from CI. The direct `db.<ref>.supabase.co:5432` string is an equally
  valid choice where IPv6 is available. Leave it unset if you apply schema
  changes through the Supabase SQL editor, as this project does —
  `prisma generate` and `next build` both succeed without it.
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

**Storage**: a private Supabase Storage bucket named `documents` holds
every uploaded file (lecture slides included), in per-user paths
(`<auth-user-id>/<category>/<lecture-or-subject-id-or-"unattached">/...`).
It needs the RLS policies in **Security model** applied before
uploads/downloads will work — without them every Storage call is
rejected, not silently public. (An earlier, now-unused `lecture-slides`
bucket exists from before file uploads were unified into the `Document`
model below — harmless and empty, kept rather than dropped since nothing
references it and deleting infrastructure isn't necessary.)

**Background file processing**: `SUPABASE_SERVICE_ROLE_KEY` and
`CRON_SECRET` (see `.env.example`) are required for
`src/app/api/cron/process-documents/route.ts` — triggered by Vercel Cron
(`vercel.json`) — to actually run. Without the service role key,
uploaded documents stay `QUEUED` indefinitely (not `FAILED`); without
`CRON_SECRET` set to match on both sides, the route returns 401 and
processes nothing. See **File intelligence layer** below.

### Vercel deployment

1. Import the repo into a new Vercel project — Next.js is auto-detected,
   the default build command (`npm run build`, from `package.json`)
   is correct as-is, no `vercel.json` build config needed. `vercel.json`
   in this repo only declares the cron schedule.
2. Add every variable from `.env.example` under Project Settings →
   Environment Variables. `NEXT_PUBLIC_*` vars are exposed client-side by
   Next.js itself, Vercel doesn't need to be told that separately; every
   other var here is server-only by default on Vercel.
3. Generate a `CRON_SECRET` (`openssl rand -hex 32` or similar) and set
   the same value in the Vercel env vars — Vercel reads it itself to sign
   the cron request, no separate "enable cron" toggle needed.
4. Deploy. `postinstall: prisma generate` (`package.json`) runs
   automatically after Vercel's `npm install`, so the Prisma Client is
   always regenerated against the current `prisma/schema.prisma` — this
   doesn't depend on Vercel's build cache behaving any particular way.

### Netlify (legacy)

The original deployment target, kept functional as a rollback path
rather than deleted outright. `netlify.toml` declares
`@netlify/plugin-nextjs` (Netlify's zero-config Next.js runtime);
`netlify/functions/process-documents.mts` is the pre-Vercel-migration
background job — functionally identical to the Vercel Cron route, just
using Netlify's Scheduled Functions convention instead of an HTTP route
+ `vercel.json`. Both can theoretically coexist (nothing about the
Vercel migration removed Netlify's ability to build this repo), but
running the same cron job from two platforms against the same database
would double-process — pick one before enabling both.

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
  token is attached per-request — see `src/lib/document-storage.ts`), not
  as the bare anon role, so those policies actually apply. The one
  exception is documented next.

### File intelligence layer

A single, reusable ingestion/processing layer (`Document` in
`prisma/schema.prisma`, `src/app/actions/documents.ts`,
`src/lib/processors/`) backs every uploaded file — lecture slides
(`LectureSlide.documentId`) today, syllabi/assignments/clinical
documents/general Smart Capture uploads later — instead of each feature
building its own upload path.

- **Lifecycle**: `UPLOADED → QUEUED → PROCESSING → COMPLETED | FAILED`,
  tracked on `Document.processingStatus`. Uploading only validates the
  file, stores it, and writes the row as `QUEUED` — it never runs
  extraction inline, so an upload request stays fast regardless of file
  size or how slow processing turns out to be.
- **Background job**: `src/app/api/cron/process-documents/route.ts`,
  triggered by Vercel Cron (`vercel.json`) — no extra vendor/queue
  service needed. **Runs once daily** (`0 3 * * *`) rather than the
  originally-designed every-10-minutes: Vercel's Hobby plan rejects any
  cron schedule that fires more than once a day, discovered when
  actually deploying, not a design choice. `BATCH_SIZE` in the route is
  raised to 20 so a full day's uploads clear in one run. On a Pro plan
  this can go back to a tight interval — it's one line in `vercel.json`
  plus the batch size constant, nothing structural. It atomically
  **claims** a batch of `QUEUED` documents (`UPDATE ... FOR UPDATE SKIP
  LOCKED`, so two overlapping invocations can never grab the same
  document) and runs `runProcessingPipeline()` on each independently
  (`Promise.allSettled` — one failure never blocks the rest). It's the
  one legitimate use of the Supabase **service role** key in this
  codebase: the job has no user session to act as, so it can't use the
  per-user-token Storage client every other code path uses. That key
  must never be used anywhere else. The route itself is protected by
  Vercel's own `CRON_SECRET` bearer-token mechanism — not the Supabase
  key — so it can't be triggered by an arbitrary request.
  `netlify/functions/process-documents.mts` is the equivalent for the
  legacy Netlify deploy path (same pipeline, same lifecycle, different
  trigger convention — see **Netlify (legacy)** above).
- **Processors** (`src/lib/processors/`) are independent modules behind
  one `DocumentProcessor` interface — `pdf-text-processor.ts` (real,
  using `pdfjs-dist`'s Node-compatible build, already a dependency for
  the slide annotator) and `ocr-processor.ts` (the extension point: no
  provider wired yet, so image documents complete with
  `metadata.ocrPending: true` rather than failing). Adding a future
  processor (classification, an AI pass, embeddings) means writing a new
  module and registering it — the upload path and every other processor
  are unaffected.
- **Retry**: `retryDocumentProcessing()` resets a `FAILED` document back
  to `QUEUED`; the next scheduled run picks it up like any other.

## Design system

Tokens live in `src/app/globals.css` (OKLCH-based, light/dark pairs for every
role) and primitives in `src/components/ui` (a small, self-built
shadcn-style kit on top of Radix). Charts follow a validated, colorblind-safe
categorical/sequential/status palette (`src/lib/chart-colors.ts`) — subject
identity colors are reused from each subject's own `color` field so the
same hue means the same subject everywhere in the app.
