# Playbooks

Step-by-step recipes for the changes most likely to be requested. Each lists **every file** you
touch so nothing is missed. Read [conventions.md](conventions.md) and
[data-model.md](data-model.md) first.

---

## Add a new field to an application

Example: add a `contact` field (recruiter name).

1. **Schema** — add to `Application` in `prisma/schema.prisma`:
   ```prisma
   contact String?
   ```
2. **Apply it** — `pnpm db:push` (host) or rebuild the Docker stack.
3. **Server actions** (`src/app/actions.ts`) — read it in `createApplication` and
   `updateApplication` via the `str()` helper and include it in the `data: {}`:
   ```ts
   contact: str(formData, "contact"),
   ```
4. **Shared type** (`src/components/ApplicationCard.tsx`) — add `contact: string | null` to the
   `Application` type.
5. **Page mappers** — include `contact: r.contact` in the row→`Application` map in both
   `src/app/page.tsx` and `src/app/applications/[id]/page.tsx`.
6. **Forms** — add a `<Field name="contact" label="Contact" />` to `AddApplicationForm.tsx` and
   `EditApplicationForm.tsx`.
7. **Display** (optional) — render it on `ApplicationCard` and/or the detail header.
8. Verify with `pnpm build`, then create/edit an application and confirm the field round-trips.

> The field name in the form (`name="contact"`) must match the `str(formData, "contact")` key.

---

## Add a new status (board column)

Example: add `SCREENING` between `APPLIED` and `INTERVIEW`.

1. **`src/lib/status.ts`** — add it to `STATUSES` **in the position you want it to appear** (the
   tuple order is the column order), and add a `STATUS_META` entry with `label`, `accent`
   (`border-*`), and `dot` (`bg-*`) Tailwind classes.
2. That's it for logic — `isStatus`, `statusLabel`, the board columns, the filter chips, and the
   per-card `<select>` all derive from `STATUSES`/`STATUS_META` automatically.
3. No schema change (status is a free string). Existing rows are unaffected.
4. Verify: `pnpm build`, then check the new column renders and you can move a card into it (the
   status-change event should read `"… → Screening"`).

> Removing/renaming a status: also decide what happens to existing rows holding the old value.
> They'll render via the `statusLabel()` raw fallback and won't appear in any column until moved.

---

## Add a new event type

Example: log an `ARCHIVED` event.

1. Pick the string constant (e.g. `"ARCHIVED"`). Event types are free strings — no schema change.
2. In the relevant server action, create the event alongside the mutation:
   ```ts
   events: { create: { type: "ARCHIVED", message: "Archived" } }
   ```
3. Add a label to `EVENT_LABEL` in `src/app/applications/[id]/page.tsx` so the timeline badge
   reads nicely (it falls back to the raw type if missing).

---

## Add a new mutation / server action

1. Add an exported async function to `src/app/actions.ts`. Follow the standard shape in
   [conventions.md](conventions.md): parse with `str()`, validate, write via `prisma`, **create
   an `Event`**, then `revalidatePath()` the affected routes.
2. Call it from a client component bound + wrapped in `useTransition` (or a `<form action={}>`).
3. If it should navigate afterward, end with `redirect()`.

---

## Add a new page/route

1. Create `src/app/<route>/page.tsx` as an async Server Component. Add
   `export const dynamic = "force-dynamic"` if it reads the DB or per-request data.
2. It is **protected automatically** — `middleware.ts` guards everything except `/login` and
   static assets. To make a route public, add it to the matcher exclusion in `middleware.ts`.
3. Query Prisma directly; map rows to plain serializable shapes before handing to client
   components.

---

## Change the auth model

- The whole gate is three files: `src/lib/auth.ts` (token), `src/app/login/actions.ts`
  (login/logout + cookie), `src/middleware.ts` (enforcement). Cookie name `pt_session`.
- The token is a deterministic HMAC of `AUTH_SECRET` — there is no server-side session store.
  Moving to multi-user/real sessions means introducing user records and per-session tokens; treat
  that as a larger design change, not a tweak.

---

## Touch the Docker build

Re-read [deployment.md](deployment.md) first. The load-bearing constraints:

- Keep build and runtime on the **same** `node:22-slim` base (Prisma engine match).
- Keep `public/` present (`public/.gitkeep`) and `output: "standalone"` in `next.config.ts`.
- New native deps → add them to `pnpm.onlyBuiltDependencies` in `package.json`.

---

## After any change — definition of done

- [ ] `pnpm build` passes (types + lint).
- [ ] App runs and the **specific changed flow** works when exercised by hand.
- [ ] Timeline still logs an event for every application mutation.
- [ ] The relevant doc(s) here and `/CLAUDE.md` reflect the new behavior.
