"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function claimEmployee(employeeId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in.");

  const alreadyLinked = await prisma.employee.findUnique({
    where: { userId: session.user.id },
  });
  if (alreadyLinked) return;

  // Guard against two people claiming the same roster row at once.
  const result = await prisma.employee.updateMany({
    where: { id: employeeId, userId: null },
    data: { userId: session.user.id },
  });
  if (result.count === 0) {
    throw new Error("That name was just claimed by someone else - contact your admin.");
  }

  revalidatePath("/");
}
