import type { ReactNode } from "react";

const VARIANT_STYLES = {
  success:
    "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-900 dark:text-green-300",
  error:
    "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300",
  warning:
    "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300",
} as const;

export function Alert({
  variant,
  children,
}: {
  variant: keyof typeof VARIANT_STYLES;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${VARIANT_STYLES[variant]}`}>
      {children}
    </div>
  );
}
