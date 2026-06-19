"use client";

import { useRef, useTransition } from "react";
import { addNote } from "@/app/actions";

export function AddNoteForm({ applicationId }: { applicationId: string }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const add = addNote.bind(null, applicationId);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await add(formData);
          formRef.current?.reset();
        })
      }
      className="flex gap-2"
    >
      <input
        name="message"
        required
        placeholder="Add a note to the timeline…"
        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
