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

## Design system

Tokens live in `src/app/globals.css` (OKLCH-based, light/dark pairs for every
role) and primitives in `src/components/ui` (a small, self-built
shadcn-style kit on top of Radix). Charts follow a validated, colorblind-safe
categorical/sequential/status palette (`src/lib/chart-colors.ts`) — subject
identity colors are reused from each subject's own `color` field so the
same hue means the same subject everywhere in the app.
