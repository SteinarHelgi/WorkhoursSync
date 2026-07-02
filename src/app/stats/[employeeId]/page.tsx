import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { SignInButton } from "@/components/auth-buttons";
import { Card } from "@/components/Card";
import { computeEmployeeStats } from "@/lib/stats";

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2 text-center dark:border-neutral-800">
      <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{value}</div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  );
}

export default async function EmployeeStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();

  if (!session) {
    return (
      <Card className="max-w-sm flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Statistics</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Sign in with an admin Google account to view shift statistics.
        </p>
        <SignInButton />
      </Card>
    );
  }

  if (!isAdminEmail(session.user?.email)) {
    return (
      <Card className="max-w-sm text-center">
        <p className="text-neutral-600 dark:text-neutral-400">
          Signed in as{" "}
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {session.user?.email}
          </span>
          , which is not an admin account for this app.
        </p>
      </Card>
    );
  }

  const { employeeId } = await params;
  const sp = await searchParams;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) notFound();

  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const stats = await computeEmployeeStats(employeeId, { from, to });

  return (
    <Card className="max-w-2xl flex flex-col gap-6">
      <div>
        <Link
          href="/stats"
          className="text-sm text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← All workers
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{employee.name}</h1>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-400">
          From
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-400">
          To
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          Apply
        </button>
        {(sp.from || sp.to) && (
          <Link
            href={`/stats/${employeeId}`}
            className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Clear (show total)
          </Link>
        )}
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatBox label="Shifts" value={stats.totalShifts} />
        <StatBox label="Hours" value={stats.totalHours} />
        <StatBox label="Day" value={stats.byCategory.day} />
        <StatBox label="Evening" value={stats.byCategory.evening} />
        <StatBox label="Night" value={stats.byCategory.night} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Shift lengths
        </h2>
        {stats.byDuration.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No shifts in this range.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {stats.byDuration.map((d) => (
              <li key={d.minutes} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-neutral-800 dark:text-neutral-100">{d.label}</span>
                <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                  {d.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Worked with
        </h2>
        {stats.coworkers.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No overlapping shifts in this range.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {stats.coworkers.map((c) => (
              <li key={c.employeeId} className="flex items-center justify-between px-4 py-2 text-sm">
                <Link
                  href={`/stats/${c.employeeId}`}
                  className="text-neutral-800 hover:underline dark:text-neutral-100"
                >
                  {c.name}
                </Link>
                <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                  {c.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
