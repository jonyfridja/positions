# CLAUDE.md — AI operating manual

This project is **maintained by AI agents**. This file is your entry point: read it
first, then consult [`docs/`](docs/README.md) for depth. Keep both in sync with the code —
when you change behavior, update the relevant doc in the same change.

## What this is

**Position Tracker** — a personal, single-user job-application tracker. A kanban board
moves applications through stages **Wishlist → Applied → Interview → Offer → Rejected**,
with full edit, search/filter, and a per-application activity timeline. Access is gated by
a single password.

## Stack (do not swap without being asked)

- **Next.js 15** App Router, **React 19**, **Server Actions** (no REST/GraphQL API layer)
- **TypeScript** (strict)
- **Prisma** ORM → **PostgreSQL**
- **Tailwind CSS v4**
- **pnpm** — the package manager. **Never use `npm` or `yarn`.**
- **Docker Compose** for the full stack (one-shot `migrate` + `app`; local dev also gets a bundled
  `db` via `docker-compose.override.yml` — production supplies its own `DATABASE_URL` instead)

## Commands

```bash
pnpm install            # deps (+ prisma generate via build scripts)
pnpm dev                # local dev server → http://localhost:3000
pnpm build              # production build (Next standalone output)
pnpm lint               # next lint — run before declaring done
pnpm db:push            # sync Prisma schema to DB (no migration files)
pnpm db:seed            # reset + load sample data (host, needs local DB)
pnpm db:studio          # inspect the DB

# Docker (preferred for a real run — matches production):
pnpm docker:up          # build + start db → migrate → app
pnpm docker:down        # stop
pnpm docker:seed        # seed inside the migrator container
```

There is **no test suite**. Verify changes by building (`pnpm build`) and running the app
(Docker or `pnpm dev`) and exercising the affected flow. See [docs/development.md](docs/development.md).

## Architecture in one screen

- **Pages are async Server Components** that query Prisma directly (`src/app/page.tsx`,
  `src/app/applications/[id]/page.tsx`). Both set `export const dynamic = "force-dynamic"`.
- **Mutations are Server Actions** in `src/app/actions.ts` (and `src/app/login/actions.ts`).
  They write via Prisma, auto-log an `Event`, then `revalidatePath()` the affected routes.
- **Client components** (`"use client"`) are thin: forms that call a server action inside
  `useTransition`. They hold UI state only, never data-fetching logic.
- **Auth** is a single password → HMAC-signed cookie (`src/lib/auth.ts`), checked by
  `src/middleware.ts` on every route except `/login` and static assets.

Full detail: [docs/architecture.md](docs/architecture.md).

## Conventions you must follow

- **All DB access goes through the `prisma` singleton** in `src/lib/status.ts`'s sibling
  `src/lib/prisma.ts`. Never instantiate `new PrismaClient()` outside `prisma.ts`/`seed.ts`.
- **`status` is a plain `String` in the DB**, not a Prisma enum. The source of truth for
  valid values is `src/lib/status.ts` (`STATUSES`, `STATUS_META`, `isStatus`, `statusLabel`).
  Always validate untrusted status input with `isStatus()`; render labels via `STATUS_META`
  or the `statusLabel()` fallback helper.
- **Form parsing** uses the `str()` helper in `actions.ts` (trims, empty → `null`). Reuse it.
- **Every mutation that changes an application should create an `Event`** (type one of
  `CREATED | STATUS_CHANGE | NOTE | UPDATED`) so the timeline stays complete.
- **After a mutation, `revalidatePath("/")` and the detail path** so Server Components refetch.
- Match the existing Tailwind utility style; no CSS modules or styled-components.

Full detail + recipes: [docs/conventions.md](docs/conventions.md) and [docs/playbooks.md](docs/playbooks.md).

## Gotchas (already bitten us)

- The Docker runner stage does `COPY /app/public` — a `public/` dir **must exist** (kept via
  `public/.gitkeep`). Don't delete it or the image build breaks.
- `migrate` uses `prisma db push` (no migration history). Schema changes apply by rebuilding
  and rerunning the stack; there are no committed migrations to review.
- Prisma `binaryTargets = ["native"]`; build and runtime both use `node:22-slim` so the query
  engine matches. Keep them on the same base image.
- `docker-compose.override.yml` (bundled Postgres) is merged **automatically** by plain
  `docker compose` invocations — that's what makes `pnpm docker:up` work locally with zero setup.
  Any command meant to run against production must pass
  `-f docker-compose.yml -f docker-compose.prod.yml` explicitly (as
  `.github/workflows/deploy.yml` does) or it'll silently pick up the local db and the wrong
  `DATABASE_URL`, and won't join the `shared-db-net` external network the production Postgres
  container lives on.
- The detail page reads `STATUS_META[record.status as keyof …]` and guards with `meta &&` —
  unknown statuses render without a badge rather than crashing.

## Working agreement for AI agents

1. **Read before writing.** Confirm current behavior in the code; this file can drift.
2. **Keep docs current.** A behavior change without a matching doc update is incomplete.
3. **Verify, don't assume.** Build + run + exercise the flow. Report what you actually saw.
4. **Stay in scope.** Don't introduce new dependencies, swap the stack, or restructure
   without being asked. Prefer the smallest change that fits existing patterns.
5. **Secrets:** `APP_PASSWORD` / `AUTH_SECRET` live in `.env` (gitignored). Never commit real
   values; `.env.example` documents the shape.
