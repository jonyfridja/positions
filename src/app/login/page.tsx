"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(login, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-slate-900">Position Tracker</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the password to continue.
        </p>

        <label className="mt-5 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Password</span>
          <input
            type="password"
            name="password"
            autoFocus
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
