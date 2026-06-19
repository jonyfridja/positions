# Data model

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma). Database is PostgreSQL.

## Models

### `Application`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String` `@id @default(cuid())` | |
| `company` | `String` | Required. |
| `role` | `String` | Required. |
| `status` | `String` `@default("WISHLIST")` | **Plain string, not an enum** — see below. Indexed. |
| `location` | `String?` | |
| `salary` | `String?` | Free text (e.g. `"$180k–$210k"`), not numeric. |
| `link` | `String?` | Job posting URL. |
| `notes` | `String?` | |
| `appliedAt` | `DateTime?` | Auto-stamped on first move out of `WISHLIST` if unset. |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |
| `events` | `Event[]` | Timeline; cascade-deleted with the application. |

### `Event`

The activity timeline. One row per logged action.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String` `@id @default(cuid())` | |
| `applicationId` | `String` | FK, `onDelete: Cascade`, indexed. |
| `type` | `String` | One of `CREATED \| STATUS_CHANGE \| NOTE \| UPDATED`. |
| `message` | `String` | Human-readable line shown in the timeline. |
| `createdAt` | `DateTime @default(now())` | Timeline ordering (desc). |

## Status is a string, governed in code

`status` and `Event.type` are stored as plain strings — there are **no Prisma enums**. This keeps
schema migrations trivial but means validation lives in the app:

- **Valid statuses + their display metadata** live in [`src/lib/status.ts`](../src/lib/status.ts):
  - `STATUSES` — the ordered tuple (also the board column order).
  - `STATUS_META[status]` — `{ label, accent, dot }` for rendering.
  - `isStatus(value)` — type guard; use it on any untrusted status input.
  - `statusLabel(value)` — label with raw-value fallback for unknown statuses.
- **Event type labels** live in a local `EVENT_LABEL` map in
  [`src/app/applications/[id]/page.tsx`](../src/app/applications/[id]/page.tsx).

If you add a status or event type, update these maps too — see
[playbooks.md](playbooks.md).

## Invariants the code maintains

- **Every application mutation logs an event.** `create` → `CREATED`, edit → `UPDATED`,
  status change → `STATUS_CHANGE` (`"From → To"`), manual note → `NOTE`. Keep this when adding
  new mutations so the timeline never has gaps.
- **`appliedAt` is stamped once.** `updateStatus` sets it to "now" the first time an application
  leaves `WISHLIST` and `appliedAt` is still null; it is never overwritten afterward.
- **A no-op status change is skipped** (no event written) when the new status equals the current.
- **Deleting an application cascades** to its events (DB-level `onDelete: Cascade`).

## Changing the schema

Migrations are **not** committed — the `migrate` service runs `prisma db push` (see
[deployment.md](deployment.md)). To apply a schema change:

1. Edit `prisma/schema.prisma`.
2. Locally: `pnpm db:push` (or rebuild the Docker stack, which runs push on startup).
3. `pnpm db:studio` to verify.

If you later want versioned history, switch `migrate` to `prisma migrate deploy` with committed
migration files.
