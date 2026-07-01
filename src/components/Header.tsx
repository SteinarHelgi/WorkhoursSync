import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
        >
          Work Shifts
        </Link>
        {session?.user && (
          <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
            <span className="hidden sm:inline">{session.user.email}</span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
