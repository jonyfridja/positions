"use client";

import { useRef, useState, useTransition } from "react";
import { createApplication } from "@/app/actions";
import { STATUSES, STATUS_META } from "@/lib/status";

export function AddApplicationForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        + Add application
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await createApplication(formData);
          formRef.current?.reset();
          setOpen(false);
        })
      }
      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2"
    >
      <Field name="company" label="Company" required />
      <Field name="role" label="Role" required />
      <Field name="location" label="Location" />
      <Field name="salary" label="Salary" />
      <Field name="link" label="Job link" type="url" className="sm:col-span-2" />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Status</span>
        <select
          name="status"
          defaultValue="WISHLIST"
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Applied on</span>
        <input
          type="date"
          name="appliedAt"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium text-slate-700">Notes</span>
        <textarea
          name="notes"
          rows={2}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
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
  className = "",
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
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
        className="rounded-md border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
