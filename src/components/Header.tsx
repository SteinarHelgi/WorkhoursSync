import Link from "next/link";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { SignOutButton } from "@/components/auth-buttons";

export async function Header() {
  const session = await auth();
  const isAdmin = isAdminEmail(session?.user?.email);

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
          >
            Work Shifts
          </Link>
          {isAdmin && (
            <nav className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
              <Link href="/admin" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Upload
              </Link>
              <Link href="/stats" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Stats
              </Link>
            </nav>
          )}
        </div>
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
