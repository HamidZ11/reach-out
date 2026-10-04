import type { CalendarDate, Instant } from "@/domain/time";
import { calendarDateIn, daysBetween } from "@/domain/time";

/**
 * Presentation-only date wording. Calendar dates are read in UTC so they never
 * shift a day. Names come from fixed tables, not the runtime's locale data:
 * ICU versions disagree ("Sep" or "Sept"), and the server and the browser must
 * render identical text or hydration fails.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parts(date: CalendarDate) {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = WEEKDAYS[d.getUTCDay()] ?? "";
  const month = MONTHS[d.getUTCMonth()] ?? "";
  return {
    day: d.getUTCDate(),
    weekday,
    shortWeekday: weekday.slice(0, 3),
    month,
    shortMonth: month.slice(0, 3),
  };
}

/** "Fri 9 Oct" */
export function shortDay(date: CalendarDate): string {
  const p = parts(date);
  return `${p.shortWeekday} ${p.day} ${p.shortMonth}`;
}

/** "Friday 9 October" */
export function longDay(date: CalendarDate): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Friday" */
export function weekday(date: CalendarDate): string {
  return parts(date).weekday;
}

/** "9 Oct" */
export function dayMonth(date: CalendarDate): string {
  const p = parts(date);
  return `${p.day} ${p.shortMonth}`;
}

export function dayOf(at: Instant, timeZone: string): CalendarDate {
  return calendarDateIn(new Date(at), timeZone);
}

/** Signed whole days from today to `date`; negative is the past. */
export function delta(today: CalendarDate, date: CalendarDate): number {
  return daysBetween(today, date);
}

/** "18:40" in the user's zone. Only numbers come from Intl; the layout is ours. */
export function clock(at: Instant, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (formatted.find((p) => p.type === type)?.value ?? "0").padStart(2, "0");
  return `${part("hour")}:${part("minute")}`;
}

/** For a past distance in days: "today", "yesterday", "8 days ago", "3 weeks ago". */
export function ago(days: number): string {
  const n = Math.abs(days);
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  return `${Math.round(n / 30)} months ago`;
}

/** For a future distance in days: "today", "tomorrow", "in 3 days". */
export function until(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** "2 days" / "1 day" */
export function dayCount(days: number): string {
  const n = Math.abs(days);
  return `${n} ${n === 1 ? "day" : "days"}`;
}

export function partOfDay(at: Instant, timeZone: string): "morning" | "afternoon" | "evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(
      new Date(at),
    ),
  );
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
