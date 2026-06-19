# Conventions

Follow these so new code is indistinguishable from existing code. Recipes for specific changes
are in [playbooks.md](playbooks.md).

## Data access

- **One Prisma client.** Import the singleton: `import { prisma } from "@/lib/prisma"`. Never
  call `new PrismaClient()` outside `src/lib/prisma.ts` (the seed script is the only exception,
  because it runs as a standalone process).
- **Reads happen in Server Components.** Query inside the async page component, then map rows to
  a plain serializable object before passing to client components (serialize `Date` → ISO string).
- **Writes happen in Server Actions** (`"use server"`), never in client components.

## Server Actions (`src/app/actions.ts`)

Every mutation follows the same shape:

```ts
export async function doThing(id: string, formData: FormData) {
  // 1. parse + validate (throw on hard failure)
  const company = str(formData, "company");
  if (!company) throw new Error("Company is required.");

  // 2. write via prisma, creating an Event in the same call
  await prisma.application.update({
    where: { id },
    data: { company, events: { create: { type: "UPDATED", message: "Details updated" } } },
  });

  // 3. revalidate every route whose data changed
  revalidatePath("/");
  revalidatePath(`/applications/${id}`);
}
```

- **Use the `str()` helper** for form fields: it trims and turns `""` into `null`. Don't
  re-implement field parsing.
- **Validate untrusted enums** with `isStatus()` from `@/lib/status` before persisting.
- **Always create the matching `Event`** (see [data-model.md](data-model.md) invariants).
- **Always `revalidatePath()`** the board (`"/"`) and, if relevant, the detail route. Omitting
  this leaves the UI stale because pages are server-rendered.
- Actions that should land the user elsewhere call `redirect()` (e.g. `deleteApplication`).

## Client components

- Add `"use client"` only when you need interactivity (state, transitions, event handlers).
- Bind the action and run it inside `useTransition`:

  ```tsx
  const [isPending, startTransition] = useTransition();
  const action = updateApplication.bind(null, app.id);
  // <form action={(fd) => startTransition(() => action(fd))}>
  ```

- Disable submit buttons while `isPending`; show a "…" label.
- Reset the form via a `ref` after a successful create/add, then close any open panel.
- Keep them thin: **no Prisma, no business logic** — just UI state + calling the action.

## Status & labels

- `STATUSES` is the canonical ordered list and also the board column order.
- Render a status with `STATUS_META[status].label` (when you know it's valid) or
  `statusLabel(value)` (when it might not be).
- Guard rendering of unknown statuses (`const meta = STATUS_META[...]; {meta && <Badge/>}`) — the
  detail page does this so legacy/unknown values don't crash.

## Styling

- Tailwind CSS v4 utility classes inline in JSX. No CSS modules, no styled-components, no
  separate stylesheet beyond `src/app/globals.css`.
- Match the existing palette (slate neutrals, per-status accent colors from `STATUS_META`).

## TypeScript

- Strict mode. The CI-equivalent gate is `pnpm build` (Next runs type-checking + lint during
  build). Run it before declaring a change done.
- Reuse the shared `Application` type from `src/components/ApplicationCard.tsx` rather than
  redeclaring row shapes.
- Path alias `@/*` maps to `src/*`.

## Package management

- **pnpm only.** Use `pnpm add` / `pnpm install`. Committing `package-lock.json` or `yarn.lock`
  is a mistake — the lockfile is `pnpm-lock.yaml`.
- Native/build-script deps must be allowlisted under `pnpm.onlyBuiltDependencies` in
  `package.json` (already includes Prisma engines, esbuild, sharp).
