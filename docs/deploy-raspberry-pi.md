# Self-hosting on a Raspberry Pi (with Cloudflare Tunnel)

This guide takes the app from "builds locally" to "running on a Raspberry Pi 5 in your
house, reachable at **`tracker.jony.fr`** over HTTPS" — with **no port forwarding and no
public IP**. It complements [deployment.md](deployment.md), which explains the Compose
stack and Docker stages themselves.

## Why this shape

A home connection has a changing IP and is often behind **CGNAT** (common with French
ISPs), so you usually *can't* forward ports to it reliably. A **Cloudflare Tunnel** sidesteps
that: a small `cloudflared` daemon on the Pi makes an **outbound** connection to Cloudflare,
and Cloudflare routes `tracker.jony.fr` traffic back down that tunnel. TLS is terminated at
Cloudflare's edge — automatic, free, no certificates to manage.

```
 Browser ──HTTPS──► Cloudflare edge ──encrypted tunnel──► cloudflared ──► app:3000
 (tracker.jony.fr)   (TLS terminated)   (outbound only)      (on the Pi, Docker network)
```

The same "outbound only" trick powers optional CI/CD: a **self-hosted GitHub Actions runner**
on the Pi polls GitHub and redeploys on push — again, no inbound ports.

## Architecture notes (already handled in code)

- **ARM64 just works.** `node:22-slim` and `postgres:16-alpine` are multi-arch; Prisma's
  `binaryTargets = ["native"]` means building *on the Pi* produces the correct ARM query engine.
- **Server Action origin check.** Behind the tunnel the public host (`tracker.jony.fr`) differs
  from the internal host (`app:3000`). Next.js 15 would reject every Server Action POST (i.e.
  every create/edit/login) unless the public origin is whitelisted. `next.config.ts` reads
  `ALLOWED_ORIGINS` for this; set it in `.env` (see below).
- **Secure cookie.** The session cookie is `Secure` in production. The browser sees HTTPS from
  Cloudflare, so login works — no change needed.
- **Tunnel is opt-in.** The `tunnel` service sits behind a Compose `profiles: [tunnel]` so local
  `docker compose up` never tries to start it. On the Pi you run with `--profile tunnel`.

---

## Part 1 — Prepare the Pi

1. **Install 64-bit Raspberry Pi OS** (Lite is enough — no desktop needed). Verify:
   ```bash
   uname -m      # expect: aarch64
   ```
2. **Install Docker + Compose plugin:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker "$USER"     # log out/in so docker works without sudo
   docker compose version              # confirm the compose plugin is present
   ```
3. **Get the code onto the Pi:**
   ```bash
   git clone <your-repo-url> ~/position-tracker
   cd ~/position-tracker
   ```

> Pi 5 (4–8 GB) builds Next.js comfortably. If a build ever gets OOM-killed, add swap:
> `sudo dphys-swapfile swapoff && sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile && sudo dphys-swapfile setup && sudo dphys-swapfile swapon`.

## Part 2 — Configure secrets

Create `~/position-tracker/.env` (gitignored) from the template:

```bash
cp .env.example .env
```

Then set real values:

```bash
APP_PASSWORD="<a strong password>"
AUTH_SECRET="<long random string>"     # e.g. `openssl rand -hex 32`
ALLOWED_ORIGINS="tracker.jony.fr"
TUNNEL_TOKEN=""                         # filled in Part 4
```

`DATABASE_URL` is **not** needed here — Compose wires the app/migrate services to the
in-stack `db` host automatically.

## Part 3 — Point jony.fr at Cloudflare (one-time)

The tunnel requires the domain's DNS to be managed by Cloudflare (free plan is fine).

1. Create a free account at <https://dash.cloudflare.com>.
2. **Add a site** → enter `jony.fr` → pick the Free plan.
3. Cloudflare gives you **two nameservers** (e.g. `xena.ns.cloudflare.com`). Go to wherever you
   registered `jony.fr` and replace its nameservers with those two.
4. Wait for Cloudflare to show the domain as **Active** (minutes to a few hours).

## Part 4 — Create the tunnel

1. In the Cloudflare dashboard: **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**.
2. Choose **Cloudflared**, name it (e.g. `home-pi`), **Save**.
3. On the install screen, copy the **tunnel token** — the long string after `--token` in the
   command they show. Put it in `.env`:
   ```bash
   TUNNEL_TOKEN="eyJ...the-long-token..."
   ```
   (You do **not** run their `cloudflared` install command — our Compose `tunnel` service runs it.)
4. Add a **public hostname** for the tunnel:
   - **Subdomain:** `tracker`  **Domain:** `jony.fr`
   - **Type:** `HTTP`  **URL:** `app:3000`
     (the service name on the Compose network — that's how the tunnel reaches the app)
5. **Save.** Cloudflare auto-creates the `tracker.jony.fr` DNS record for you.

## Part 5 — Launch

```bash
cd ~/position-tracker
docker compose --profile tunnel up -d --build
```

This builds the ARM images, runs `migrate` (syncs the schema), starts `app`, and starts the
`tunnel`. Verify:

```bash
docker compose ps -a                 # migrate should be "exited (0)"; app + tunnel "running"
curl -I http://localhost:3000        # on the Pi: expect a redirect to /login
docker compose logs tunnel           # expect "Registered tunnel connection" lines
```

Then open **https://tracker.jony.fr** from anywhere → you should hit the login page and be
able to sign in with `APP_PASSWORD`.

---

## Part 6 — Auto-deploy on push (optional)

A self-hosted runner on the Pi turns `git push` into a deploy. `.github/workflows/deploy.yml`
is already in the repo and targets a `[self-hosted, linux, ARM64]` runner.

1. **Install the runner** (GitHub repo → **Settings → Actions → Runners → New self-hosted
   runner → Linux / ARM64**) and follow the shown `./config.sh` / `./run.sh` steps **inside a
   checkout the workflow will use** (the workflow checks out into the runner's `_work` dir).
2. **Install it as a service** so it survives reboots:
   ```bash
   sudo ./svc.sh install && sudo ./svc.sh start
   ```
3. **Make `.env` available to the workflow's checkout.** The runner checks out a fresh copy under
   `~/actions-runner/_work/position-tracker/position-tracker`, so symlink your real `.env` in:
   ```bash
   ln -s ~/position-tracker/.env \
     ~/actions-runner/_work/position-tracker/position-tracker/.env
   ```
   Keep secrets on the Pi, never in GitHub. (Persisting the `db_data` volume is handled by
   Compose, so rebuilds don't lose data.)

Now every push to `main` rebuilds and restarts the stack on the Pi.

---

## Operations

- **Update by hand:** `git pull && docker compose --profile tunnel up -d --build`
- **Logs:** `docker compose logs -f app` (or `tunnel`)
- **Restart:** `docker compose --profile tunnel restart app`
- **Stop everything:** `docker compose --profile tunnel down`
- **Back up the database** (the only stateful piece — the `db_data` volume):
  ```bash
  docker compose exec db pg_dump -U postgres position_tracker > backup-$(date +%F).sql
  ```

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Login or any save fails with *"x-forwarded-host … does not match origin"* | `ALLOWED_ORIGINS` is unset/wrong. Set it to `tracker.jony.fr` in `.env`, then `up -d --build`. |
| `tracker.jony.fr` shows a Cloudflare 1033 / "tunnel not found" | Tunnel container isn't running or `TUNNEL_TOKEN` is wrong. Check `docker compose logs tunnel`. |
| Site loads on the Pi (`localhost:3000`) but not publicly | Tunnel route points at the wrong service. In the dashboard it must be `HTTP → app:3000`. |
| Build killed / runs out of memory | Add swap (see Part 1 note). |
| Login page loops back to itself | `AUTH_SECRET` changed between deploys (invalidates existing cookies) — just log in again. |
