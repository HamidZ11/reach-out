import { describe, expect, it } from "vitest";
import { calendarDate, instant } from "@/domain/time";
import { clock, dayMonth, longDay, shortDay } from "./dates";

/**
 * Server and browser must render the same words, or hydration fails. These
 * pin the wording so it can't drift with the runtime's locale data.
 */
describe("date wording", () => {
  it("uses the same month and weekday names everywhere", () => {
    const date = calendarDate("2026-09-26");
    expect(shortDay(date)).toBe("Sat 26 Sep");
    expect(longDay(date)).toBe("Saturday 26 September");
    expect(dayMonth(date)).toBe("26 Sep");
  });

  it("formats a time as 24-hour hours and minutes in the user's zone", () => {
    expect(clock(instant("2026-10-04T17:05:00Z"), "Europe/London")).toBe("18:05");
    expect(clock(instant("2026-10-04T23:30:00Z"), "Europe/London")).toBe("00:30");
  });
});
