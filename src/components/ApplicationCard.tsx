"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteApplication, updateStatus } from "@/app/actions";
import { STATUSES, STATUS_META, type Status } from "@/lib/status";

export type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  location: string | null;
  salary: string | null;
  link: string | null;
  notes: string | null;
  appliedAt: string | null;
};

export function ApplicationCard({ app }: { app: Application }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/applications/${app.id}`} className="group">
          <p className="font-semibold leading-tight text-slate-900 group-hover:underline">
            {app.role}
          </p>
          <p className="text-sm text-slate-500">{app.company}</p>
        </Link>
        <button
          onClick={() =>
            startTransition(() => {
              deleteApplication(app.id);
            })
          }
          disabled={isPending}
          aria-label="Delete"
          className="text-slate-300 hover:text-rose-500 disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      {(app.location || app.salary) && (
        <p className="mt-1 text-xs text-slate-500">
          {[app.location, app.salary].filter(Boolean).join(" · ")}
        </p>
      )}

      {app.notes && (
        <p className="mt-2 line-clamp-3 text-xs text-slate-600">{app.notes}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <select
          value={app.status}
          disabled={isPending}
          onChange={(e) =>
            startTransition(() => {
              updateStatus(app.id, e.target.value);
            })
          }
          className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s as Status].label}
            </option>
          ))}
        </select>

        {app.link && (
          <a
            href={app.link}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Posting ↗
          </a>
        )}
      </div>
    </div>
  );
}
