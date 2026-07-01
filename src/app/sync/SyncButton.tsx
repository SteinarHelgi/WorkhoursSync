"use client";

import { useActionState } from "react";
import { syncCalendarAction, type SyncState } from "./actions";
import { Alert } from "@/components/Alert";

const initialState: SyncState = { status: "idle", message: "" };

export function SyncButton() {
  const [state, formAction, isPending] = useActionState(syncCalendarAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isPending ? "Syncing..." : "Add shifts to Google Calendar"}
      </button>
      {state.status === "success" && <Alert variant="success">{state.message}</Alert>}
      {state.status === "error" && <Alert variant="error">{state.message}</Alert>}
    </form>
  );
}
