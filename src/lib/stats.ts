import { prisma } from "@/lib/db";

export type ShiftCategory = "day" | "evening" | "night";

/** Day 06:00-14:59, evening 15:00-19:59, night 20:00-05:59, bucketed by start time. */
export function shiftCategory(startTime: string): ShiftCategory {
  const hour = Number(startTime.slice(0, 2));
  if (hour >= 6 && hour < 15) return "day";
  if (hour >= 15 && hour < 20) return "evening";
  return "night";
}

export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60; // overnight shift
  return endMinutes - startMinutes;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

interface ShiftLike {
  date: Date;
  startTime: string;
  endTime: string;
}

function shiftInterval(shift: ShiftLike): { start: Date; end: Date } {
  const dateStr = shift.date.toISOString().slice(0, 10);
  const start = new Date(`${dateStr}T${shift.startTime}:00Z`);
  let end = new Date(`${dateStr}T${shift.endTime}:00Z`);
  if (shift.endTime <= shift.startTime) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function intervalsOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface StatsDateRange {
  from?: Date;
  to?: Date;
}

export interface EmployeeStats {
  totalShifts: number;
  totalHours: number;
  byCategory: Record<ShiftCategory, number>;
  byDuration: { minutes: number; label: string; count: number }[];
  coworkers: { employeeId: string; name: string; count: number }[];
}

/**
 * Absences (FJARVERA) are excluded entirely - they aren't work shifts and
 * shouldn't count toward totals, category breakdowns, or "worked with" pairs.
 */
export async function computeEmployeeStats(
  employeeId: string,
  range: StatsDateRange
): Promise<EmployeeStats> {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (range.from) dateFilter.gte = range.from;
  if (range.to) dateFilter.lte = range.to;
  const whereDate = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

  const [myShifts, otherShifts] = await Promise.all([
    prisma.shift.findMany({ where: { employeeId, isAbsence: false, ...whereDate } }),
    prisma.shift.findMany({
      where: { employeeId: { not: employeeId }, isAbsence: false, ...whereDate },
      include: { employee: { select: { id: true, name: true } } },
    }),
  ]);

  const byCategory: Record<ShiftCategory, number> = { day: 0, evening: 0, night: 0 };
  const durationCounts = new Map<number, number>();
  let totalMinutes = 0;

  for (const s of myShifts) {
    byCategory[shiftCategory(s.startTime)]++;
    const minutes = shiftDurationMinutes(s.startTime, s.endTime);
    totalMinutes += minutes;
    durationCounts.set(minutes, (durationCounts.get(minutes) ?? 0) + 1);
  }

  const myIntervals = myShifts.map((s) => shiftInterval(s));
  const otherIntervals = otherShifts.map((s) => ({ shift: s, interval: shiftInterval(s) }));

  const coworkerCounts = new Map<string, { name: string; count: number }>();
  for (const mine of myIntervals) {
    const seenForThisShift = new Set<string>();
    for (const other of otherIntervals) {
      if (seenForThisShift.has(other.shift.employeeId)) continue;
      if (!intervalsOverlap(mine, other.interval)) continue;
      seenForThisShift.add(other.shift.employeeId);
      const existing = coworkerCounts.get(other.shift.employeeId);
      coworkerCounts.set(other.shift.employeeId, {
        name: other.shift.employee.name,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return {
    totalShifts: myShifts.length,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    byCategory,
    byDuration: [...durationCounts.entries()]
      .map(([minutes, count]) => ({ minutes, count, label: formatDuration(minutes) }))
      .sort((a, b) => b.count - a.count || b.minutes - a.minutes),
    coworkers: [...coworkerCounts.entries()]
      .map(([id, v]) => ({ employeeId: id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
