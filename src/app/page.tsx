import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { SignInButton } from "@/components/auth-buttons";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { claimEmployee } from "@/app/match/actions";
import { upcomingShiftsForEmployee } from "@/lib/shifts";
import { ShiftList } from "@/components/ShiftList";
import { SyncButton } from "@/app/sync/SyncButton";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return (
      <Card className="max-w-sm flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Work Shifts</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Sign in with Google to see your upcoming shifts and add them to your calendar.
        </p>
        <SignInButton />
      </Card>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
  });

  if (!employee) {
    const unmatched = await prisma.employee.findMany({
      where: { userId: null },
      orderBy: { name: "asc" },
    });

    return (
      <Card className="max-w-md flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Which one are you?</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Signed in as {session.user.email}. Pick your name from the roster - you only
            need to do this once.
          </p>
        </div>
        {unmatched.length === 0 ? (
          <Alert variant="warning">
            No unclaimed names left in the roster - contact your admin.
          </Alert>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {unmatched.map((e) => (
              <form key={e.id} action={claimEmployee.bind(null, e.id)}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-800 transition-colors hover:border-indigo-400 hover:bg-indigo-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-indigo-950/30"
                >
                  {e.name}
                </button>
              </form>
            ))}
          </div>
        )}
      </Card>
    );
  }

  const shifts = await upcomingShiftsForEmployee(employee.id);

  return (
    <Card className="max-w-xl flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome back, {employee.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Your upcoming shifts</p>
      </div>
      <SyncButton />
      <ShiftList shifts={shifts} />
    </Card>
  );
}
