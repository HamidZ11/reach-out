import { describe, expect, it } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import type { TodayItem } from "@/domain/today";
import { loadToday } from "./load-today";

const subjectOf = (item: TodayItem): string => {
  switch (item.kind) {
    case "overdue_follow_up":
    case "upcoming_action":
      return item.nextActionId;
    case "reply_awaiting_response":
      return item.personId;
    case "deadline_approaching":
      return item.opportunityId;
    case "draft_awaiting_approval":
    case "draft_ready_to_send":
      return item.draftId;
  }
};

describe("loadToday", () => {
  it("derives a realistic day from repository records", async () => {
    const today = calendarDate("2026-10-05");
    const repository = createSeedRepository(createSeedDataset(today), SEED_USER_ID);

    const items = await loadToday(repository, today);

    expect(items.map((item) => `${item.kind} ${subjectOf(item)}`)).toEqual([
      "overdue_follow_up act_01",
      // Daniel replied, so his overdue follow-up (act_02) is superseded.
      "reply_awaiting_response prs_01",
      // Due in 5 days; the research placement (20 days) is outside the window.
      "deadline_approaching opp_01",
      "draft_awaiting_approval drf_01",
      "draft_ready_to_send drf_02",
      "upcoming_action act_04",
      "upcoming_action act_08",
      "upcoming_action act_05",
      "upcoming_action act_06",
      // act_03 is due in 4 days: outside the upcoming window.
    ]);
  });
});
