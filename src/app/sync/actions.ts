"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { upcomingShiftsForEmployee } from "@/lib/shifts";
import { syncEmployeeShiftsToGoogleCalendar } from "@/lib/googleCalendar";

export interface SyncState {
  status: "idle" | "success" | "error";
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's signature
export async function syncCalendarAction(_prevState: SyncState): Promise<SyncState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "Not signed in." };
  }

  const [employee, user] = await Promise.all([
    prisma.employee.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { id: true, workCalendarId: true },
    }),
  ]);
  if (!employee) {
    return { status: "error", message: "Pick your name from the roster first." };
  }

  try {
    const shifts = await upcomingShiftsForEmployee(employee.id);
    const summary = await syncEmployeeShiftsToGoogleCalendar(user, employee.id, shifts);
    return {
      status: "success",
      message: `Added ${summary.added}, updated ${summary.updated}, removed ${summary.removed} shifts (${summary.unchanged} already up to date).`,
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Sync failed.",
    };
  }
}
