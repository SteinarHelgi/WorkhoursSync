import Link from "next/link";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { SignInButton } from "@/components/auth-buttons";
import { Card } from "@/components/Card";

export default async function StatsIndexPage() {
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

  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });

  return (
    <Card className="max-w-lg flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Shift statistics</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Pick a worker to see their shift breakdown and who they work with most.
        </p>
      </div>
      {employees.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No roster yet - upload a schedule first.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {employees.map((e) => (
            <Link
              key={e.id}
              href={`/stats/${e.id}`}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 transition-colors hover:border-indigo-400 hover:bg-indigo-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-indigo-950/30"
            >
              {e.name}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
