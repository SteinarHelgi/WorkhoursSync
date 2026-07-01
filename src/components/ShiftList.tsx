import type { Shift } from "@/generated/prisma/client";

const dateFormatter = new Intl.DateTimeFormat("is-IS", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function ShiftList({ shifts }: { shifts: Shift[] }) {
  if (shifts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        No upcoming shifts on the schedule yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {shifts.map((shift) => (
        <li key={shift.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <div className="flex items-baseline gap-3">
            <span className="font-medium capitalize text-neutral-800 dark:text-neutral-100">
              {dateFormatter.format(shift.date)}
            </span>
            <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
              {shift.startTime}-{shift.endTime}
            </span>
          </div>
          {shift.isAbsence && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              Leave
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
