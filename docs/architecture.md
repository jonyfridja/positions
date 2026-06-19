# Architecture

## Shape

A Next.js App Router app with **no separate API layer**. The browser talks to:

- **Server Components** for reads — they call Prisma directly during render.
- **Server Actions** for writes — invoked from form `action={}` / event handlers.

There is no client-side data store, no fetch layer, no tRPC/REST/GraphQL. State lives in
PostgreSQL; the UI is re-rendered from the server after each mutation.

```
Browser
  │  (request)
  ▼
middleware.ts ──── not authenticated ───▶ redirect /login
  │  authenticated (valid pt_session cookie)
  ▼
Server Component (page.tsx / applications/[id]/page.tsx)
  │  prisma.application.findMany / findUnique
  ▼
PostgreSQL  ◀── Prisma ──▶  Server Action (actions.ts)
                              ▲  create / update / updateStatus / addNote / delete
                              │  + create Event, revalidatePath()
Client component (form) ──────┘  bound action inside useTransition
```

## Request lifecycle

1. **Middleware** (`src/middleware.ts`) runs on every matched route (everything except
   `/login`, `_next/static`, `_next/image`, `favicon.ico`). It reads the `pt_session` cookie
   and verifies it against `AUTH_SECRET`. Invalid → 307 redirect to `/login`.
2. **Page render** — the matched Server Component is `force-dynamic`, so it runs per request.
   It reads `searchParams` (board: `q`, `status`), queries Prisma, maps rows to a plain
   `Application` shape, and renders.
3. **Mutation** — a form/button in a client component calls a bound Server Action inside
   `startTransition`. The action validates input, writes via Prisma, creates an `Event`, and
   calls `revalidatePath()` for the routes whose data changed. The transition resolves and the
   affected Server Components re-render with fresh data.

## Server vs. client boundary

- **Server Components** (default): `src/app/page.tsx`, `src/app/applications/[id]/page.tsx`,
  `src/app/layout.tsx`. They may import Prisma and read env. They never carry `"use client"`.
- **Server Actions**: `src/app/actions.ts`, `src/app/login/actions.ts` (`"use server"`).
- **Client Components** (`"use client"`): `AddApplicationForm`, `EditApplicationForm`,
  `ApplicationCard`, `AddNoteForm`, and the login page. They hold local UI state (open/closed,
  pending) and wrap server actions in `useTransition`. They must not import Prisma.

The `Application` type (the plain serializable shape passed Server → Client) is defined once in
`src/components/ApplicationCard.tsx` and reused. `Date` fields are serialized to ISO strings at
the boundary.

## Auth

Single shared password, no user accounts.

- `src/lib/auth.ts` — `createSessionToken(secret)` derives a **deterministic** HMAC-SHA-256
  token from `AUTH_SECRET` (Web Crypto, so it runs in the edge middleware). `verifySessionToken`
  compares in constant time. The cookie name is `pt_session`.
- `src/app/login/actions.ts` — `login()` checks the submitted password against `APP_PASSWORD`,
  and on success sets `pt_session` (httpOnly, sameSite=lax, secure in production, 30-day expiry).
  `logout()` deletes it.
- `src/middleware.ts` — the gate described above.

Because the token is a pure function of the secret, rotating `AUTH_SECRET` invalidates all
existing sessions. There is no per-session state on the server.

## Key files

| File | Role |
| --- | --- |
| `src/middleware.ts` | Auth gate (edge). |
| `src/lib/auth.ts` | HMAC token sign/verify, cookie name. |
| `src/lib/prisma.ts` | The Prisma client singleton (hot-reload-safe). |
| `src/lib/status.ts` | Status source of truth: `STATUSES`, `STATUS_META`, `isStatus`, `statusLabel`. |
| `src/app/page.tsx` | Kanban board: search + status filter + columns. |
| `src/app/applications/[id]/page.tsx` | Detail: edit form + activity timeline + delete. |
| `src/app/actions.ts` | App mutations: create / update / updateStatus / addNote / delete. |
| `src/app/login/{page,actions}.tsx/.ts` | Login form + login/logout actions. |
| `src/components/*` | Thin client forms. |
| `prisma/schema.prisma` | `Application` + `Event` models. |

See [data-model.md](data-model.md) for the schema and [conventions.md](conventions.md) for the
patterns these files follow.
