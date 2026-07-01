"use server";

import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { parseScheduleWorkbook } from "@/lib/scheduleParser";
import { ingestSchedule } from "@/lib/ingestSchedule";

export interface UploadState {
  status: "idle" | "success" | "error";
  message: string;
  warnings?: string[];
}

export async function uploadScheduleAction(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return { status: "error", message: "Not authorized." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a .xlsx file first." };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return { status: "error", message: "Could not read the uploaded file." };
  }

  try {
    const parsed = parseScheduleWorkbook(buffer);
    if (parsed.shifts.length === 0) {
      return { status: "error", message: "No shifts found in that file - is it the right export?" };
    }
    const result = await ingestSchedule(parsed, session!.user!.email!);
    return {
      status: "success",
      message: `Imported ${result.shiftsImported} shifts for ${result.employeesSeen} employees (${result.periodLabel}).`,
      warnings: parsed.warnings,
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to parse the file.",
    };
  }
}
