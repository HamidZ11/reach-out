import { describe, expect, it } from "vitest";
import { buildNextAction } from "@/test/builders";
import {
  completeNextAction,
  dismissNextAction,
  rescheduleNextAction,
  snoozeNextAction,
} from "./next-action";
import { calendarDate, instant } from "./time";

const TODAY = calendarDate("2026-03-10");
const AT = instant("2026-03-10T09:00:00Z");

describe("next actions", () => {
  it("completes an open action once", () => {
    const done = completeNextAction(buildNextAction(), AT);
    expect(done).toMatchObject({ status: "done", completedAt: AT });
    expect(() => completeNextAction(done, AT)).toThrow(
      expect.objectContaining({ code: "next_action_not_open" }),
    );
    expect(() => dismissNextAction(done, AT)).toThrow(
      expect.objectContaining({ code: "next_action_not_open" }),
    );
  });

  it("snoozes an overdue action from today, and a future one from its due date", () => {
    expect(snoozeNextAction(buildNextAction({ dueOn: "2026-03-01" }), 2, TODAY, AT).dueOn).toBe(
      "2026-03-12",
    );
    expect(snoozeNextAction(buildNextAction({ dueOn: "2026-03-20" }), 2, TODAY, AT).dueOn).toBe(
      "2026-03-22",
    );
    expect(() => snoozeNextAction(buildNextAction(), 0, TODAY, AT)).toThrow(
      expect.objectContaining({ code: "invalid_snooze" }),
    );
  });

  it("cannot be rescheduled into the past", () => {
    const action = buildNextAction({ dueOn: "2026-03-01" });
    expect(() => rescheduleNextAction(action, calendarDate("2026-03-09"), TODAY, AT)).toThrow(
      expect.objectContaining({ code: "due_date_in_past" }),
    );
    expect(rescheduleNextAction(action, TODAY, TODAY, AT).dueOn).toBe(TODAY);
  });

  it("must be attached to a person or an opportunity", () => {
    expect(() =>
      buildNextAction({ kind: "research", personId: undefined, opportunityId: undefined }),
    ).toThrow(/attached to a person or an opportunity/);
  });
});
