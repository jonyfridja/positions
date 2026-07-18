# Deployment

The app ships as a Docker Compose stack: a one-shot schema-sync job and the Next.js app running
in standalone mode, plus — **in local dev only** — a bundled Postgres container.

> Self-hosting on a Raspberry Pi at home, reachable on a custom domain over HTTPS? See
> [deploy-raspberry-pi.md](deploy-raspberry-pi.md) — it covers ARM, the Cloudflare Tunnel
> (`tunnel` Compose profile), the `ALLOWED_ORIGINS` Server-Action fix, and optional CI/CD.

## Three compose files, one database story

- **`docker-compose.yml`** — the base stack (`migrate`, `app`, `tunnel`). No database service.
  `DATABASE_URL` has **no default** here — Compose refuses to start without one.
- **`docker-compose.override.yml`** — local-dev-only additions: a `db` (`postgres:16-alpine`)
  service with a `pg_isready` healthcheck and a `db_data` volume, plus overrides that hardcode
  `migrate`/`app`'s `DATABASE_URL` to the internal `db` host and add `depends_on: db (healthy)`.
  Docker Compose merges this file in **automatically** whenever you run `docker compose` without
  explicit `-f` flags — which is exactly what `pnpm docker:up` / `:down` / `:seed` do — so local
  dev always gets a disposable, self-contained Postgres with zero setup.
- **`docker-compose.prod.yml`** — production-only additions: joins `migrate`/`app` to an
  **external** Docker network, `shared-db-net`, so they can reach a Postgres container running
  elsewhere on the host (its own separate stack, not managed by this compose project). Compose
  never merges this in automatically — the Pi deploy workflow explicitly passes
  `-f docker-compose.yml -f docker-compose.prod.yml`.

Production always runs with explicit `-f` flags (base + prod overlay, override skipped), so the
local-dev `db` never applies there, and `DATABASE_URL` (from the `DATABASE_URL` secret) points at
whatever Postgres container you've attached to `shared-db-net` — see
[deploy-raspberry-pi.md](deploy-raspberry-pi.md) for how to set that network up.

## Compose services

| Service | Image / build | Where | Role |
| --- | --- | --- | --- |
| `db` | `postgres:16-alpine` | override only (local dev) | Database. `pg_isready` healthcheck; data persisted in the `db_data` volume. Exposes `5432`. |
| `migrate` | built from `target: migrator` | base (+ prod overlay for networking) | **One-shot.** Runs `prisma db push --skip-generate --accept-data-loss` against `DATABASE_URL`, exits 0. `restart: "no"`. Waits on `db` healthy in local dev (override adds that dependency); in production it joins `shared-db-net` instead (prod overlay). |
| `app` | built from `target: runner` | base (+ prod overlay for networking) | The Next.js server on `3000`. Starts after `migrate` completes successfully (and, locally, after `db` is healthy). In production it also joins `shared-db-net`. |
| `tunnel` | `cloudflare/cloudflared` | base | **Opt-in** (`profiles: [tunnel]`). Serves the app publicly via an outbound Cloudflare Tunnel — no open inbound ports. Needs `TUNNEL_TOKEN`. See [deploy-raspberry-pi.md](deploy-raspberry-pi.md). |

Env (`APP_PASSWORD`, `AUTH_SECRET`) is read from the host shell / `.env`, with `changeme` /
`dev-secret-change-me` fallbacks for local convenience. **Override both in any real deployment.**
`ALLOWED_ORIGINS` (public hostname, for the Server-Action origin check behind a proxy) and
`TUNNEL_TOKEN` are read from `.env`/secrets; both are empty/unused in plain local runs.

> The `tunnel` service only starts when you pass `--profile tunnel` (e.g.
> `docker compose --profile tunnel up -d`). Plain `docker compose up` runs `migrate` + `app` (plus
> the local-only `db` via the override file).

## Dockerfile stages (`Dockerfile`)

Multi-stage build on `node:22-slim` (chosen so Prisma's `native` query engine matches at runtime;
OpenSSL is installed for Prisma):

1. **base** — node:22-slim + openssl + corepack.
2. **deps** — `pnpm install --frozen-lockfile` (build scripts run, so Prisma engines are fetched).
3. **builder** — `prisma generate` then `pnpm build` → produces `.next/standalone`.
4. **migrator** — slim image with deps + Prisma CLI + schema; its `CMD` is the `db push`. Used by
   the `migrate` service.
5. **runner** — copies `public/`, `.next/standalone`, and `.next/static`; runs `node server.js`.

### Things that must hold

- **`public/` must exist** — the runner stage does `COPY --from=builder /app/public ./public`.
  It's kept in git via `public/.gitkeep`. Removing it breaks the image build.
- **Same base image for build and runtime** (`node:22-slim`) so the Prisma engine binary matches
  the `native` target. If you change one, change both, or set `binaryTargets` accordingly.
- **`output: "standalone"`** in `next.config.ts` is what makes the small runner image work. Don't
  remove it without updating the Dockerfile copy paths.
- Build-script deps (Prisma, esbuild, sharp) are allowlisted in `package.json`
  `pnpm.onlyBuiltDependencies`; the deps stage relies on this to fetch engines.

## Schema management in production

The `migrate` service uses **`prisma db push`**, not migrations — there is no migration history.
A schema change is deployed by rebuilding the images and bringing the stack up again; `migrate`
re-syncs the DB before `app` starts.

> Trade-off: `--accept-data-loss` means a destructive schema change can drop columns/data without
> a review step. For a personal tracker this is acceptable; if the data becomes valuable, switch
> `migrate` to `prisma migrate deploy` with committed migration files and drop `--accept-data-loss`.

## Deploy checklist

1. Set strong `APP_PASSWORD` and a long random `AUTH_SECRET` in the deploy environment.
2. Create the external `shared-db-net` Docker network on the host (once) and make sure your
   production Postgres container is attached to it.
3. Set `DATABASE_URL` to that Postgres container's name as the host, e.g.
   `postgresql://user:pass@postgres:5432/dbname?schema=public` — production has no bundled
   database, so this must resolve on `shared-db-net`.
4. `docker compose -f docker-compose.yml -f docker-compose.prod.yml build && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
   (the explicit `-f` flags skip the local-dev override file/bundled `db` and apply the prod
   network overlay instead).
5. Confirm `migrate` exited 0 (`docker compose ps -a`) and `app` is healthy.
6. Hit the URL → expect redirect to `/login`; log in to confirm DB connectivity end-to-end.
7. Back up whatever Postgres container you attached to `shared-db-net` directly (there's no
   `db_data` volume in production — that only exists for the local-dev bundled container).
