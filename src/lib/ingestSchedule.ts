import { prisma } from "@/lib/db";
import type { ParsedSchedule } from "@/lib/scheduleParser";

export interface IngestResult {
  periodLabel: string;
  shiftsImported: number;
  employeesSeen: number;
}

export async function ingestSchedule(
  parsed: ParsedSchedule,
  uploadedBy: string
): Promise<IngestResult> {
  const employeeNumbers = [...new Set(parsed.shifts.map((s) => s.employeeNumber))];
  const namesByNumber = new Map(parsed.shifts.map((s) => [s.employeeNumber, s.employeeName]));

  return prisma.$transaction(async (tx) => {
    let period = await tx.schedulePeriod.findFirst({
      where: { orgUnit: parsed.orgUnit, startDate: parsed.startDate, endDate: parsed.endDate },
    });
    if (period) {
      period = await tx.schedulePeriod.update({
        where: { id: period.id },
        data: { uploadedAt: new Date(), uploadedBy },
      });
    } else {
      period = await tx.schedulePeriod.create({
        data: {
          orgUnit: parsed.orgUnit,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          uploadedBy,
        },
      });
    }

    // Re-uploading a period replaces its shifts entirely.
    await tx.shift.deleteMany({ where: { periodId: period.id } });

    const employeeIdByNumber = new Map<string, string>();
    for (const employeeNumber of employeeNumbers) {
      const employee = await tx.employee.upsert({
        where: { employeeNumber },
        update: { name: namesByNumber.get(employeeNumber)! },
        create: { employeeNumber, name: namesByNumber.get(employeeNumber)! },
      });
      employeeIdByNumber.set(employeeNumber, employee.id);
    }

    await tx.shift.createMany({
      data: parsed.shifts.map((s) => ({
        periodId: period.id,
        employeeId: employeeIdByNumber.get(s.employeeNumber)!,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        isAbsence: s.isAbsence,
        rawText: s.rawText,
      })),
    });

    return {
      periodLabel: `${parsed.orgUnit}: ${parsed.startDate.toISOString().slice(0, 10)} to ${parsed.endDate.toISOString().slice(0, 10)}`,
      shiftsImported: parsed.shifts.length,
      employeesSeen: employeeNumbers.length,
    };
  });
}
