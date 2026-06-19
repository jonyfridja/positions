"use client";

import { useTransition } from "react";
import { updateApplication } from "@/app/actions";
import type { Application } from "@/components/ApplicationCard";

export function EditApplicationForm({ app }: { app: Application }) {
  const [isPending, startTransition] = useTransition();
  const update = updateApplication.bind(null, app.id);
  const appliedDate = app.appliedAt ? app.appliedAt.slice(0, 10) : "";

  return (
    <form
      action={(formData) => startTransition(() => update(formData))}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <Field name="company" label="Company" defaultValue={app.company} required />
      <Field name="role" label="Role" defaultValue={app.role} required />
      <Field name="location" label="Location" defaultValue={app.location ?? ""} />
      <Field name="salary" label="Salary" defaultValue={app.salary ?? ""} />
      <Field
        name="link"
        label="Job link"
        type="url"
        defaultValue={app.link ?? ""}
        className="sm:col-span-2"
      />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Applied on</span>
        <input
          type="date"
          name="appliedAt"
          defaultValue={appliedDate}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium text-slate-700">Notes</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={app.notes ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  defaultValue,
  className = "",
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="rounded-md border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
