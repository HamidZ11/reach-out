import type { Repository } from "@/data/repository";
import type { CalendarDate } from "@/domain/time";
import type { TodayItem } from "@/domain/today";
import { deriveToday } from "@/domain/today";

/** Reads what Today needs and derives it. Works with any Repository implementation. */
export async function loadToday(repository: Repository, today: CalendarDate): Promise<TodayItem[]> {
  const [people, opportunities, interactions, drafts, nextActions] = await Promise.all([
    repository.people.list(),
    repository.opportunities.list(),
    repository.interactions.list(),
    repository.drafts.list(),
    repository.nextActions.list({ status: "open" }),
  ]);
  return deriveToday({ today, people, opportunities, interactions, drafts, nextActions });
}
