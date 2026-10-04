import { z } from "zod";

/**
 * Two kinds of time exist in the domain:
 *
 * - CalendarDate: a day as the user experiences it (deadlines, due dates).
 *   No time of day, no zone. Formatted YYYY-MM-DD, so string order is date order.
 * - Instant: a moment something happened (a message was sent). UTC, ISO 8601 with Z.
 *
 * Domain functions never read the clock. Callers pass `today` or `at` explicitly.
 */

export const CalendarDateSchema = z.iso.date().brand<"CalendarDate">();
export type CalendarDate = z.infer<typeof CalendarDateSchema>;

export const InstantSchema = z.iso.datetime().brand<"Instant">();
export type Instant = z.infer<typeof InstantSchema>;

const MS_PER_DAY = 86_400_000;

export function calendarDate(value: string): CalendarDate {
  return CalendarDateSchema.parse(value);
}

export function instant(value: string): Instant {
  return InstantSchema.parse(value);
}

function utcMidnight(date: CalendarDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return calendarDate(new Date(utcMidnight(date) + days * MS_PER_DAY).toISOString().slice(0, 10));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}

export function laterDate(a: CalendarDate, b: CalendarDate): CalendarDate {
  return a >= b ? a : b;
}

/** Compares by time, not by string, so differing ISO precisions sort correctly. */
export function compareInstants(a: Instant, b: Instant): number {
  return Date.parse(a) - Date.parse(b);
}

/** The calendar date of `at` as observed in an IANA time zone. */
export function calendarDateIn(at: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return calendarDate(`${part("year")}-${part("month")}-${part("day")}`);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
}
