import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STATUSES, STATUS_META, isStatus } from "@/lib/status";
import { AddApplicationForm } from "@/components/AddApplicationForm";
import { ApplicationCard, type Application } from "@/components/ApplicationCard";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status: statusFilter } = await searchParams;
  const query = q?.trim() ?? "";

  const where: Prisma.ApplicationWhereInput = {};
  if (query) {
    where.OR = [
      { company: { contains: query, mode: "insensitive" } },
      { role: { contains: query, mode: "insensitive" } },
    ];
  }
  if (isStatus(statusFilter)) where.status = statusFilter;

  const records = await prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const apps: Application[] = records.map((r) => ({
    id: r.id,
    company: r.company,
    role: r.role,
    status: r.status,
    location: r.location,
    salary: r.salary,
    link: r.link,
    notes: r.notes,
    appliedAt: r.appliedAt ? r.appliedAt.toISOString() : null,
  }));

  // When a status filter is active, show just that column; otherwise the full board.
  const columns = isStatus(statusFilter) ? [statusFilter] : STATUSES;
  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, apps.filter((a) => a.status === s)]),
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Position Tracker</h1>
          <p className="text-sm text-slate-500">
            {apps.length} application{apps.length === 1 ? "" : "s"} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddApplicationForm />
          <form action={logout}>
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
              Log out
            </button>
          </form>
        </div>
      </header>

      <form className="mb-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search company or role…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Search
        </button>
        <div className="ml-2 flex flex-wrap gap-1">
          <FilterChip label="All" href={query ? `/?q=${encodeURIComponent(query)}` : "/"} active={!statusFilter} />
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              label={STATUS_META[s].label}
              href={`/?${new URLSearchParams({ ...(query ? { q: query } : {}), status: s })}`}
              active={statusFilter === s}
            />
          ))}
        </div>
      </form>

      <div
        className={
          isStatus(statusFilter)
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        }
      >
        {isStatus(statusFilter)
          ? byStatus[statusFilter].map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))
          : columns.map((status) => {
              const meta = STATUS_META[status];
              const column = byStatus[status];
              return (
                <section
                  key={status}
                  className={`flex flex-col gap-3 rounded-xl border-t-4 bg-slate-100/60 p-3 ${meta.accent}`}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <h2 className="text-sm font-semibold text-slate-700">
                      {meta.label}
                    </h2>
                    <span className="ml-auto text-xs text-slate-400">
                      {column.length}
                    </span>
                  </div>

                  {column.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-slate-400">
                      Nothing here yet
                    </p>
                  ) : (
                    column.map((app) => <ApplicationCard key={app.id} app={app} />)
                  )}
                </section>
              );
            })}
      </div>

      {apps.length === 0 && (
        <p className="mt-10 text-center text-sm text-slate-400">
          No applications match. Try a different search or add one.
        </p>
      )}
    </main>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
