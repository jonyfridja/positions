# Deployment

The app ships as a Docker Compose stack: a Postgres database, a one-shot schema-sync job, and
the Next.js app running in standalone mode.

> Self-hosting on a Raspberry Pi at home, reachable on a custom domain over HTTPS? See
> [deploy-raspberry-pi.md](deploy-raspberry-pi.md) — it covers ARM, the Cloudflare Tunnel
> (`tunnel` Compose profile), the `ALLOWED_ORIGINS` Server-Action fix, and optional CI/CD.

## Compose services (`docker-compose.yml`)

| Service | Image / build | Role |
| --- | --- | --- |
| `db` | `postgres:16-alpine` | Database. Has a `pg_isready` healthcheck; data persisted in the `db_data` volume. Exposes `5432`. |
| `migrate` | built from `target: migrator` | **One-shot.** Waits for `db` healthy, runs `prisma db push --skip-generate --accept-data-loss`, exits 0. `restart: "no"`. |
| `app` | built from `target: runner` | The Next.js server on `3000` (published to `127.0.0.1` only). Starts after `db` is healthy **and** `migrate` completed successfully. |
| `tunnel` | `cloudflare/cloudflared` | **Opt-in** (`profiles: [tunnel]`). Serves the app publicly via an outbound Cloudflare Tunnel — no open inbound ports. Needs `TUNNEL_TOKEN`. See [deploy-raspberry-pi.md](deploy-raspberry-pi.md). |

Env (`APP_PASSWORD`, `AUTH_SECRET`) is read from the host shell / `.env`, with `changeme` /
`dev-secret-change-me` fallbacks for local convenience. **Override both in any real deployment.**
`DATABASE_URL` is hardcoded in compose to the internal `db` host. `ALLOWED_ORIGINS` (public
hostname, for the Server-Action origin check behind a proxy) and `TUNNEL_TOKEN` are read from
`.env`; both are empty/unused in plain local runs.

> The `tunnel` service only starts when you pass `--profile tunnel` (e.g.
> `docker compose --profile tunnel up -d`). Plain `docker compose up` runs just `db` + `migrate`
> + `app`, unchanged from before.

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
2. Point `DATABASE_URL` at the production Postgres (compose already wires the in-stack `db`).
3. `docker compose build && docker compose up -d`.
4. Confirm `migrate` exited 0 (`docker compose ps -a`) and `app` is healthy.
5. Hit the URL → expect redirect to `/login`; log in to confirm DB connectivity end-to-end.
6. Back up the `db_data` volume if the data matters.
