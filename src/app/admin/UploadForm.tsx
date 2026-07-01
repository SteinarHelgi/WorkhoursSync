"use client";

import { useActionState } from "react";
import { uploadScheduleAction, type UploadState } from "./actions";
import { Alert } from "@/components/Alert";

const initialState: UploadState = { status: "idle", message: "" };

export function UploadForm() {
  const [state, formAction, isPending] = useActionState(uploadScheduleAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="file"
        name="file"
        accept=".xlsx"
        required
        className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-neutral-400 dark:file:bg-indigo-950/40 dark:file:text-indigo-300"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload schedule"}
      </button>

      {state.status === "success" && <Alert variant="success">{state.message}</Alert>}
      {state.status === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.warnings && state.warnings.length > 0 && (
        <Alert variant="warning">
          <p className="mb-1 font-medium">{state.warnings.length} warning(s) while parsing:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {state.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
    </form>
  );
}
