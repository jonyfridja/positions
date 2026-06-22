# Self-hosting on a Raspberry Pi (CI/CD + optional Cloudflare Tunnel)

This guide takes the app from "in a public GitHub repo" to "running on a Raspberry Pi 5 in
your house, auto-deployed on every `git push`." It works in two phases:

1. **Now (no domain):** the app runs on the Pi, reachable on your LAN at `http://<pi-ip>:3000`.
2. **Later (with a domain):** a Cloudflare Tunnel publishes it at `https://your-domain` — no
   port forwarding, no public IP, works behind CGNAT.

All secrets — password, auth secret, and (later) the domain and tunnel token — live in
**GitHub Actions secrets**, never in this public repo. A **self-hosted runner on the Pi** does
the deploys. It complements [deployment.md](deployment.md) (the Compose stack / Docker stages).

## How the deploy works

```
 git push main ─► GitHub ─► (self-hosted runner ON the Pi polls outbound)
                              │
                              ├─ injects secrets from GitHub Actions secrets
                              └─ docker compose up -d --build   (rebuild + restart)
```

The runner polls GitHub from inside your network, so **no inbound ports** are ever opened.
`.github/workflows/deploy.yml` passes the secrets as environment variables to `docker compose`;
nothing sensitive is written to disk, and GitHub masks the values in logs.

> ⚠️ **Public repo + self-hosted runner.** The workflow triggers **only** on push to `main`
> (which only you can do) and manual dispatch — never on `pull_request` — so a stranger's fork
> PR can't execute code on your Pi or read your secrets. As belt-and-suspenders, set
> **repo → Settings → Actions → General → Fork pull request workflows → "Require approval for
> all external contributors."** Don't add `pull_request` triggers to this workflow.

## Architecture notes (already handled in code)

- **ARM64 just works.** `node:22-slim` and `postgres:16-alpine` are multi-arch; Prisma's
  `binaryTargets = ["native"]` means building *on the Pi* yields the correct ARM query engine.
- **Server Action origin check.** Behind a tunnel the public host differs from the internal host
  (`app:3000`); Next.js 15 would reject every Server Action POST unless the public origin is
  whitelisted. `next.config.ts` reads `ALLOWED_ORIGINS`, which is **baked in at build time** and
  passed as a Docker build arg (`docker-compose.yml`) from the `ALLOWED_ORIGINS` secret. Empty
  until you have a domain; localhost/LAN access doesn't need it.
- **Tunnel is opt-in.** The `tunnel` service sits behind a Compose `profiles: [tunnel]`. The
  workflow enables it automatically **only when the `TUNNEL_TOKEN` secret is set.**

---

## Part 1 — Prepare the Pi

1. **64-bit Raspberry Pi OS** (Lite is enough). Verify: `uname -m` → `aarch64`.
2. **Docker + Compose, set to start on boot:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker "$USER"     # log out/in so docker works without sudo
   sudo systemctl enable docker        # autostart on boot → survives power cuts
   docker compose version
   ```

> Pi 5 (4–8 GB) builds Next.js comfortably. If a build is ever OOM-killed, add swap:
> `sudo dphys-swapfile swapoff && sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile && sudo dphys-swapfile setup && sudo dphys-swapfile swapon`.

## Part 2 — Set the GitHub Actions secrets

From your laptop (or anywhere with `gh`), in the repo:

```bash
gh secret set APP_PASSWORD --body "<a strong password>"
gh secret set AUTH_SECRET  --body "$(openssl rand -hex 32)"
# ALLOWED_ORIGINS and TUNNEL_TOKEN are added later, in Part 5 (domain phase).
```

Or via the web UI: **repo → Settings → Secrets and variables → Actions → New repository secret.**
These are write-only — GitHub never shows them again, and they're injected only during a
workflow run on your runner.

## Part 3 — Install the self-hosted runner on the Pi

1. **repo → Settings → Actions → Runners → New self-hosted runner → Linux / ARM64.** Follow the
   shown download + `./config.sh --url ... --token ...` steps **on the Pi**. Accept the default
   labels (they include `self-hosted`, `linux`, `ARM64` — which the workflow targets).
2. **Install it as a service** so it runs headless and survives reboots:
   ```bash
   cd ~/actions-runner
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

The runner now polls GitHub. No Docker or repo clone needed by hand — the workflow checks the
code out into the runner's workspace and builds there.

## Part 4 — First deploy (LAN, no domain yet)

Trigger a deploy. Either push any commit to `main`, or run it manually:

```bash
gh workflow run deploy.yml      # or: push to main
gh run watch                    # follow the run
```

The runner builds the ARM images, runs `migrate` (schema sync), and starts `app`. Because no
`TUNNEL_TOKEN` secret is set yet, it deploys **LAN-only**. Find the Pi's IP (`hostname -I`) and
open from any device on your network:

```
http://<pi-ip>:3000
```

You should hit the login page and sign in with `APP_PASSWORD`. Server Actions work fine here:
direct access means the request Origin matches the host, so no `ALLOWED_ORIGINS` is needed.

---

## Part 5 — Add a domain later (Cloudflare Tunnel)

When you've bought a domain and want public HTTPS access at `https://tracker.<your-domain>`:

1. **Put the domain on Cloudflare** (free): dash.cloudflare.com → Add a site → switch the
   domain's nameservers to the two Cloudflare gives you → wait for **Active**.
2. **Create a tunnel:** Zero Trust → Networks → Tunnels → Create → Cloudflared. Copy the
   **tunnel token**. Add a **public hostname**: subdomain `tracker`, your domain, **Type** `HTTP`,
   **URL** `app:3000` (the Compose service name). Save — Cloudflare creates the DNS record.
3. **Add the two secrets** (the domain stays out of the repo this way):
   ```bash
   gh secret set ALLOWED_ORIGINS --body "tracker.<your-domain>"
   gh secret set TUNNEL_TOKEN    --body "<the-tunnel-token>"
   ```
4. **Redeploy:** `gh workflow run deploy.yml`. The workflow now sees `TUNNEL_TOKEN`, brings up the
   `tunnel` service, and rebuilds the app with the right `ALLOWED_ORIGINS` baked in.

Open `https://tracker.<your-domain>` from anywhere. (Tighten LAN exposure if you like by adding
an `APP_BIND_ADDR=127.0.0.1` secret/var so the app is only reachable via the tunnel.)

---

## Operations

- **Deploy:** just `git push` to `main` (or `gh workflow run deploy.yml`).
- **Logs:** `docker compose logs -f app` (or `tunnel`).
- **Restart:** `docker compose restart app`.
- **Reboots / power cuts:** Docker autostarts (Part 1) and restarts the containers with their
  baked-in env, so the app comes back on its own; the tunnel reconnects automatically.
- **Back up the database** (the only stateful piece — the `db_data` volume):
  ```bash
  docker compose exec db pg_dump -U postgres position_tracker > backup-$(date +%F).sql
  ```
- **Run a manual deploy by hand** (outside CI): you must provide the env vars yourself, e.g.
  `APP_PASSWORD=... AUTH_SECRET=... docker compose up -d --build`, since no `.env` is kept on disk.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Workflow stuck "Queued" | The self-hosted runner isn't online. `sudo ./svc.sh status` on the Pi. |
| Login or any save fails with *"x-forwarded-host … does not match origin"* | `ALLOWED_ORIGINS` secret missing/wrong. Set it to your public host and **redeploy** (it's baked in at build, so a rebuild is required). |
| Public URL shows Cloudflare 1033 / "tunnel not found" | Tunnel container not running or `TUNNEL_TOKEN` wrong. `docker compose logs tunnel`. |
| Loads on the LAN but not publicly | Tunnel public hostname must route `HTTP → app:3000` in the dashboard. |
| Build killed / out of memory | Add swap (see Part 1 note). |
| Login loops back | `AUTH_SECRET` changed between deploys (invalidates cookies) — just log in again. |
