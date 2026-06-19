import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STATUS_META } from "@/lib/status";
import { deleteApplication } from "@/app/actions";
import { EditApplicationForm } from "@/components/EditApplicationForm";
import { AddNoteForm } from "@/components/AddNoteForm";
import type { Application } from "@/components/ApplicationCard";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Created",
  STATUS_CHANGE: "Status",
  NOTE: "Note",
  UPDATED: "Edited",
};

export default async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const record = await prisma.application.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "desc" } } },
  });

  if (!record) notFound();

  const app: Application = {
    id: record.id,
    company: record.company,
    role: record.role,
    status: record.status,
    location: record.location,
    salary: record.salary,
    link: record.link,
    notes: record.notes,
    appliedAt: record.appliedAt ? record.appliedAt.toISOString() : null,
  };

  const meta = STATUS_META[record.status as keyof typeof STATUS_META];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Back to board
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{record.role}</h1>
          <p className="text-slate-500">{record.company}</p>
        </div>
        {meta && (
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        )}
      </header>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Details
        </h2>
        <EditApplicationForm app={app} />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Activity timeline
        </h2>
        <AddNoteForm applicationId={record.id} />
        <ol className="mt-4 space-y-3">
          {record.events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="mt-0.5 inline-block w-16 shrink-0 rounded bg-slate-100 px-2 py-0.5 text-center text-xs font-medium text-slate-500">
                {EVENT_LABEL[event.type] ?? event.type}
              </span>
              <div>
                <p className="text-slate-800">{event.message}</p>
                <p className="text-xs text-slate-400">
                  {event.createdAt.toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <form action={deleteApplication.bind(null, record.id)}>
          <button className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
            Delete application
          </button>
        </form>
      </section>
    </main>
  );
}
