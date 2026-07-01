import { prisma } from "@/lib/db";

/** Midnight UTC for the current calendar day, matching how shift dates are stored. */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function upcomingShiftsForEmployee(employeeId: string) {
  return prisma.shift.findMany({
    where: { employeeId, date: { gte: todayUTC() } },
    orderBy: { date: "asc" },
  });
}
