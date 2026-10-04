import { describe, expect, it } from "vitest";
import { addDays, calendarDate, calendarDateIn, daysBetween } from "./time";

describe("calendar dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays(calendarDate("2026-12-30"), 3)).toBe("2027-01-02");
    expect(addDays(calendarDate("2026-03-01"), -1)).toBe("2026-02-28");
  });

  it("counts whole days regardless of daylight saving changes", () => {
    // UK clocks go forward on 29 March 2026.
    expect(daysBetween(calendarDate("2026-03-28"), calendarDate("2026-03-30"))).toBe(2);
    expect(daysBetween(calendarDate("2026-03-30"), calendarDate("2026-03-28"))).toBe(-2);
  });

  it("resolves 'today' in the user's time zone, not UTC", () => {
    const lateEvening = new Date("2026-07-14T23:30:00Z");
    expect(calendarDateIn(lateEvening, "Europe/London")).toBe("2026-07-15");
    expect(calendarDateIn(lateEvening, "UTC")).toBe("2026-07-14");
  });
});
