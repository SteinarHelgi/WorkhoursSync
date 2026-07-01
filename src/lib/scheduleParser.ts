import * as XLSX from "xlsx";

export interface ParsedShift {
  employeeName: string;
  employeeNumber: string;
  /** UTC midnight for the shift's calendar date */
  date: Date;
  startTime: string;
  endTime: string;
  isAbsence: boolean;
  rawText: string;
}

export interface ParsedSchedule {
  orgUnit: string;
  startDate: Date;
  endDate: Date;
  shifts: ParsedShift[];
  warnings: string[];
}

const PERIOD_RE = /(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/;
const TIME_RANGE_RE = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/;

/**
 * A day's cell can hold more than one shift (split shifts), space-separated,
 * e.g. "23:00-08:30 14:00-22:59". A trailing "FJARVERA" token marks every
 * shift in the cell as leave rather than work, e.g. "08:00-14:29 FJARVERA"
 * or "08:00-14:29 08:00-14:29 FJARVERA" (the same range listed twice - kept
 * as one shift, duplicates are collapsed).
 */
function parseCell(
  raw: string
): { isAbsence: boolean; segments: { startTime: string; endTime: string }[] } | null {
  const tokens = raw.split(/\s+/);
  const isAbsence = tokens[tokens.length - 1].toUpperCase() === "FJARVERA";
  const timeTokens = isAbsence ? tokens.slice(0, -1) : tokens;
  if (timeTokens.length === 0) return null;

  const seen = new Set<string>();
  const segments: { startTime: string; endTime: string }[] = [];
  for (const token of timeTokens) {
    const match = TIME_RANGE_RE.exec(token);
    if (!match) return null;
    const startTime = normalizeTime(match[1]);
    const endTime = normalizeTime(match[2]);
    const key = `${startTime}-${endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    segments.push({ startTime, endTime });
  }
  return { isAbsence, segments };
}

function utcDate(day: number, month: number, year: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function normalizeTime(t: string): string {
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

function cellToString(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/** Normalizes the "Nr. starfs" employee number cell, which SheetJS may
 * read as a float like 342149.0, to a plain integer string. */
function normalizeEmployeeNumber(v: unknown): string {
  const s = cellToString(v);
  const n = Number(s);
  if (s !== "" && Number.isFinite(n)) return String(Math.trunc(n));
  return s;
}

export function parseScheduleWorkbook(buffer: Buffer): ParsedSchedule {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  const warnings: string[] = [];

  const orgUnitRow = rows.find((r) => cellToString(r[0]) === "Skipulagseining:");
  const periodRow = rows.find((r) => cellToString(r[0]) === "Tímabil áætlunar:");
  if (!orgUnitRow || !periodRow) {
    throw new Error(
      "Could not find 'Skipulagseining:' / 'Tímabil áætlunar:' rows - is this the expected export format?"
    );
  }
  const orgUnit = cellToString(orgUnitRow[1]);

  const periodMatch = PERIOD_RE.exec(cellToString(periodRow[1]));
  if (!periodMatch) {
    throw new Error(`Could not parse schedule period from "${cellToString(periodRow[1])}"`);
  }
  const [, d1, m1, y1, d2, m2, y2] = periodMatch;
  const startDate = utcDate(Number(d1), Number(m1), Number(y1));
  const endDate = utcDate(Number(d2), Number(m2), Number(y2));

  const headerIdx = rows.findIndex((r) => cellToString(r[0]) === "Nafn");
  if (headerIdx === -1) {
    throw new Error("Could not find the 'Nafn' header row");
  }
  const dayHeaderRow = rows[headerIdx + 1];
  const employeeRowsStart = headerIdx + 2;

  const FIRST_DAY_COL = 2; // column C - columns A/B are Name/Employee number
  let lastDayCol = FIRST_DAY_COL - 1;
  for (let c = FIRST_DAY_COL; c < dayHeaderRow.length; c++) {
    if (cellToString(dayHeaderRow[c]) !== "") lastDayCol = c;
  }
  const numDayCols = lastDayCol - FIRST_DAY_COL + 1;

  const expectedDays =
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (numDayCols !== expectedDays) {
    warnings.push(
      `Period spans ${expectedDays} days but found ${numDayCols} day columns - using the day columns present in the sheet.`
    );
  }

  const shifts: ParsedShift[] = [];

  for (let r = employeeRowsStart; r < rows.length; r++) {
    const row = rows[r];
    const employeeName = cellToString(row[0]);
    if (employeeName === "") continue; // blank/separator row, or end of table

    const employeeNumber = normalizeEmployeeNumber(row[1]);
    if (employeeNumber === "") {
      warnings.push(`Row ${r + 1}: employee "${employeeName}" has no employee number, skipping.`);
      continue;
    }

    for (let c = FIRST_DAY_COL; c <= lastDayCol; c++) {
      const raw = cellToString(row[c]);
      if (raw === "") continue;

      const date = addDays(startDate, c - FIRST_DAY_COL);
      const parsedCell = parseCell(raw);
      if (!parsedCell) {
        warnings.push(
          `Could not parse shift for ${employeeName} on ${date.toISOString().slice(0, 10)}: "${raw}"`
        );
        continue;
      }

      for (const segment of parsedCell.segments) {
        shifts.push({
          employeeName,
          employeeNumber,
          date,
          startTime: segment.startTime,
          endTime: segment.endTime,
          isAbsence: parsedCell.isAbsence,
          rawText: raw,
        });
      }
    }
  }

  return { orgUnit, startDate, endDate, shifts, warnings };
}
