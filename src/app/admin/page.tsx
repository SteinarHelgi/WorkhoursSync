import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { SignInButton } from "@/components/auth-buttons";
import { Card } from "@/components/Card";
import { UploadForm } from "./UploadForm";

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    return (
      <Card className="max-w-sm flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Sign in with an admin Google account to upload a schedule.
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

  return (
    <Card className="max-w-lg flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Upload shift schedule</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Upload the monthly .xlsx export. Re-uploading a period replaces its shifts.
        </p>
      </div>
      <UploadForm />
    </Card>
  );
}
