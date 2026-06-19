# Development

## Prerequisites

- Node 22 + **pnpm** (`corepack enable` provides the pinned version).
- For local (non-Docker) runs: a reachable PostgreSQL instance.
- For the full stack: Docker + Docker Compose.

## Environment

Copy the template and adjust:

```bash
cp .env.example .env
```

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Host runs use `localhost`; the Docker `app`/`migrate` services override this to the internal `db` host. |
| `APP_PASSWORD` | The single password to access the app. |
| `AUTH_SECRET` | Secret used to derive/sign the session cookie. Rotating it logs everyone out. |

`.env` is gitignored — never commit real secrets.

## Run it: two ways

### A. Docker (recommended — mirrors production)

```bash
pnpm docker:up      # builds images, starts db → migrate → app
# open http://localhost:3000  → /login  → password = APP_PASSWORD
pnpm docker:seed    # optional sample data
pnpm docker:down    # stop
```

Startup order is enforced by compose: `db` becomes healthy, the one-shot `migrate` service runs
`prisma db push` and exits 0, then `app` starts. See [deployment.md](deployment.md) for the stack
internals.

### B. Local dev server (fast iteration)

```bash
pnpm install
pnpm db:push        # sync schema to the DB in DATABASE_URL
pnpm db:seed        # optional sample data
pnpm dev            # http://localhost:3000
```

## Scripts reference

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next dev server with HMR. |
| `pnpm build` | Production build + type-check + lint (the de-facto verification gate). |
| `pnpm start` | Run a production build locally. |
| `pnpm lint` | `next lint`. |
| `pnpm db:push` | Push `schema.prisma` to the DB (no migration files). |
| `pnpm db:migrate` | `prisma migrate dev` — only if you opt into versioned migrations. |
| `pnpm db:seed` | Reset all data and load `prisma/seed.ts` (host process). |
| `pnpm db:studio` | Prisma Studio DB browser. |
| `pnpm docker:up` / `:down` | Bring the full Docker stack up / down. |
| `pnpm docker:seed` | Run the seed inside the migrator container (use with the Docker DB). |

## Verifying a change (no automated tests)

There is no test suite. The expected verification loop:

1. `pnpm build` — must pass (catches type + lint errors).
2. Run the app (Docker or `pnpm dev`).
3. Log in and **exercise the specific flow you changed** — create/edit/move/delete an
   application, check the board counts, open the detail page, confirm the timeline logged the
   right event.
4. Report what you actually observed, including failures.

You can drive the running app with a browser tool to confirm UI behavior end-to-end (the auth
redirect, login, board, detail page have all been verified this way).

## Common issues

- **Redirected to `/login` immediately** — expected when no valid `pt_session` cookie. Log in
  with `APP_PASSWORD`. If login fails server-side, check `APP_PASSWORD`/`AUTH_SECRET` are set.
- **Prisma "missing query engine" at runtime** — base image mismatch. Build and runtime must
  both be `node:22-slim` (the schema targets `native`). See [deployment.md](deployment.md).
- **Docker build fails on `COPY /app/public`** — the `public/` dir is missing. It's kept via
  `public/.gitkeep`; restore it.
- **Schema change not reflected** — rerun `pnpm db:push` (host) or rebuild the stack so the
  `migrate` service re-pushes.
