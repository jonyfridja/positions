# Position Tracker

A personal, single-user job application tracker. Add positions you're interested in and move
them across a kanban board — **Wishlist → Applied → Interview → Offer → Rejected** — as you
progress through each hiring pipeline. Full edit, search/filter, and a per-application activity
timeline, behind a single-password gate.

## Stack

- **Next.js 15** (App Router, React 19, Server Actions)
- **TypeScript**
- **Prisma** ORM → **PostgreSQL**
- **Tailwind CSS v4**
- **pnpm** (package manager) · **Docker Compose** (full stack)

## Quick start (Docker)

```bash
cp .env.example .env     # set APP_PASSWORD and AUTH_SECRET
pnpm docker:up           # build + start db → migrate → app
# open http://localhost:3000 → /login (password = APP_PASSWORD)
pnpm docker:seed         # optional: load sample applications
```

## Quick start (local dev)

```bash
cp .env.example .env     # point DATABASE_URL at a local Postgres
pnpm install
pnpm db:push             # sync the schema
pnpm db:seed             # optional sample data
pnpm dev                 # http://localhost:3000
```

## Documentation

This project is **maintained by AI agents**. The full documentation lives in:

- [`CLAUDE.md`](CLAUDE.md) — the AI operating manual (start here)
- [`docs/`](docs/README.md) — architecture, data model, conventions, development, deployment,
  and step-by-step playbooks for common changes

## Useful scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build (type-check + lint) |
| `pnpm lint` | Lint |
| `pnpm db:push` | Sync the Prisma schema to the DB |
| `pnpm db:seed` | Reset and load sample data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm docker:up` / `:down` | Bring the Docker stack up / down |
| `pnpm docker:seed` | Seed inside the migrator container |

## Data model

An `Application` has `company`, `role`, `status`, `location`, `salary`, `link`, `notes`,
`appliedAt`, plus `createdAt`/`updatedAt`. Status is one of `WISHLIST`, `APPLIED`, `INTERVIEW`,
`OFFER`, `REJECTED`. Each application has an `Event[]` timeline (`CREATED`, `STATUS_CHANGE`,
`NOTE`, `UPDATED`). See [docs/data-model.md](docs/data-model.md).
