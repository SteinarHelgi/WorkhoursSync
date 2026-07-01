import { google } from "googleapis";
import { prisma } from "@/lib/db";

const CALENDAR_SUMMARY = "Work Shifts";
const TIME_ZONE = "Atlantic/Reykjavik"; // Iceland does not observe DST, always UTC+0

async function getOAuthClientForUser(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.refresh_token) {
    throw new Error(
      "No Google Calendar access on file for this account - sign out and sign in again to grant access."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: account.refresh_token });
  return oauth2Client;
}

async function ensureWorkCalendar(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  user: { id: string; workCalendarId: string | null }
): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  if (user.workCalendarId) {
    try {
      await calendar.calendars.get({ calendarId: user.workCalendarId });
      return user.workCalendarId;
    } catch {
      // Calendar was deleted on the Google side - fall through and recreate it.
    }
  }

  const created = await calendar.calendars.insert({
    requestBody: { summary: CALENDAR_SUMMARY, timeZone: TIME_ZONE },
  });
  const calendarId = created.data.id!;
  await prisma.user.update({ where: { id: user.id }, data: { workCalendarId: calendarId } });
  return calendarId;
}

interface ShiftLike {
  date: Date;
  startTime: string;
  endTime: string;
  isAbsence: boolean;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A day can have more than one shift (split shifts), so the time range is
 * part of a shift's identity for matching against previously synced events. */
function shiftKey(shift: { date: Date; startTime: string; endTime: string }): string {
  return `${dateKey(shift.date)}|${shift.startTime}|${shift.endTime}`;
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toEventBody(shift: ShiftLike) {
  const startDateStr = dateKey(shift.date);
  // Overnight shifts (e.g. 22:00-08:00) end on the following calendar day.
  const endDateStr =
    shift.endTime <= shift.startTime ? addDaysISO(startDateStr, 1) : startDateStr;

  return {
    summary: shift.isAbsence ? "Fjarvera (leave)" : "Work shift",
    start: { dateTime: `${startDateStr}T${shift.startTime}:00`, timeZone: TIME_ZONE },
    end: { dateTime: `${endDateStr}T${shift.endTime}:00`, timeZone: TIME_ZONE },
    colorId: shift.isAbsence ? "8" : undefined, // graphite - visually distinct from work shifts
  };
}

function snapshotEquals(a: ShiftLike, b: ShiftLike): boolean {
  return a.startTime === b.startTime && a.endTime === b.endTime && a.isAbsence === b.isAbsence;
}

export interface SyncSummary {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
}

export async function syncEmployeeShiftsToGoogleCalendar(
  user: { id: string; workCalendarId: string | null },
  employeeId: string,
  desiredShifts: ShiftLike[]
): Promise<SyncSummary> {
  const oauth2Client = await getOAuthClientForUser(user.id);
  const calendarId = await ensureWorkCalendar(oauth2Client, user);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const synced = await prisma.syncedShiftEvent.findMany({ where: { employeeId } });
  const syncedByKey = new Map(synced.map((s) => [shiftKey(s), s]));

  const summary: SyncSummary = { added: 0, updated: 0, removed: 0, unchanged: 0 };

  for (const shift of desiredShifts) {
    const key = shiftKey(shift);
    const existing = syncedByKey.get(key);
    syncedByKey.delete(key);

    if (!existing) {
      const event = await calendar.events.insert({
        calendarId,
        requestBody: toEventBody(shift),
      });
      await prisma.syncedShiftEvent.create({
        data: {
          employeeId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isAbsence: shift.isAbsence,
          googleCalendarId: calendarId,
          googleEventId: event.data.id!,
        },
      });
      summary.added++;
    } else if (!snapshotEquals(existing, shift)) {
      await calendar.events.update({
        calendarId: existing.googleCalendarId,
        eventId: existing.googleEventId,
        requestBody: toEventBody(shift),
      });
      await prisma.syncedShiftEvent.update({
        where: { id: existing.id },
        data: {
          startTime: shift.startTime,
          endTime: shift.endTime,
          isAbsence: shift.isAbsence,
          googleCalendarId: calendarId,
        },
      });
      summary.updated++;
    } else {
      summary.unchanged++;
    }
  }

  // Anything left in syncedByKey no longer has a matching shift - the
  // schedule changed and this event should be removed from the calendar.
  for (const stale of syncedByKey.values()) {
    try {
      await calendar.events.delete({
        calendarId: stale.googleCalendarId,
        eventId: stale.googleEventId,
      });
    } catch {
      // Already gone on the Google side - fine, just clean up our record.
    }
    await prisma.syncedShiftEvent.delete({ where: { id: stale.id } });
    summary.removed++;
  }

  return summary;
}
