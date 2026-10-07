import { RecordSetSchema } from "@/domain/records";
import type { RecordSet } from "@/domain/records";
import type { CalendarDate } from "@/domain/time";
import { addDays } from "@/domain/time";
import { createSeedDataset } from "./dataset";

/**
 * The demo workspace's records (D-035): the seed dataset, unchanged, plus one
 * recent conversation, so every working Outreach track has someone in it.
 * The seed itself stays as it is: the design reference and the screens'
 * tests read it.
 *
 * Like the seed, everything is fictional, and dates are relative to the
 * anchor day.
 */
export function createDemoDataset(anchor: CalendarDate): RecordSet {
  const seed = createSeedDataset(anchor);
  const at = (offset: number, time: string) => `${addDays(anchor, offset)}T${time}:00Z`;
  const olivia = seed.people.find((p) => p.id === "prs_07");
  const insight = seed.opportunities.find((o) => o.id === "opp_04");
  if (!olivia || !insight) throw new Error("The seed dataset changed: update the demo's additions");

  return RecordSetSchema.parse({
    ...seed,
    interactions: [
      ...seed.interactions,
      {
        id: "int_demo_01",
        userId: seed.users[0]?.id,
        personId: olivia.id,
        opportunityId: insight.id,
        kind: "meeting",
        format: "in_person",
        occurredAt: at(-4, "18:30"),
        summary:
          "Caught up at the alumni careers evening. She said Spring Insight assessment days are being scheduled now, and to keep an eye on my inbox.",
        createdAt: at(-4, "21:00"),
        updatedAt: at(-4, "21:00"),
      },
    ],
  });
}
