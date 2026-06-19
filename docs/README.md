# Documentation index

This project is **maintained by AI agents**. Start with [`/CLAUDE.md`](../CLAUDE.md) at the
repo root — it is the operating manual and is auto-loaded by Claude Code. These docs are the
deeper reference behind it.

When you change behavior, update the matching doc **in the same change**. Stale docs are worse
than none for an AI that trusts them.

## Map

| Doc | Read it when… |
| --- | --- |
| [architecture.md](architecture.md) | You need the big picture: request flow, server vs. client boundaries, auth. |
| [data-model.md](data-model.md) | You're touching the schema, statuses, or the event/timeline model. |
| [conventions.md](conventions.md) | You're writing code and want to match existing patterns. |
| [development.md](development.md) | You're running, seeding, or debugging the app locally or in Docker. |
| [deployment.md](deployment.md) | You're changing the Docker build, env vars, or how it ships. |
| [deploy-raspberry-pi.md](deploy-raspberry-pi.md) | You're self-hosting on a Raspberry Pi behind a Cloudflare Tunnel (home server, custom domain). |
| [playbooks.md](playbooks.md) | You're making a common change (add a field, add a status, etc.) and want the recipe. |

## The 30-second model

- Server Components query Prisma directly. Server Actions mutate + log an event + revalidate.
- Client components are thin forms wrapping server actions in `useTransition`.
- One password → signed cookie → middleware gate. PostgreSQL via Prisma. pnpm. Docker.
