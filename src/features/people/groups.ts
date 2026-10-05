import type { PersonId } from "@/domain/ids";
import type { Opportunity } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import { compareInstants } from "@/domain/time";
import { deadlineText, STAGE_LABEL } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";

/**
 * How People arranges the user's people: by what they can help with. This is
 * presentation over the records, not a product rule — status comes from the
 * domain (Today's items and the outreach state).
 */

type Day = Pick<WorkspaceState, "today" | "records" | "index">;

export type Group = { key: string; title: string; meta?: string; people: Person[] };

/** Search matches a person's name, role or company, ignoring case. */
export function matchesQuery(person: Person, query: string, day: Day): boolean {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    [person.name, person.role ?? "", day.index.companyOf(person)?.name ?? ""].some((v) =>
      v.toLowerCase().includes(q),
    )
  );
}

/**
 * One group per active opportunity, upcoming deadlines first; then people from
 * closed opportunities; then people not linked to anything. Empty groups are
 * left out. A person linked to two opportunities appears under both.
 */
export function groupsOf(day: Day, query: string): Group[] {
  const matches = (p: Person) => matchesQuery(p, query, day);
  const upcoming = (o: Opportunity) =>
    o.deadline && o.deadline >= day.today ? o.deadline : "9999";
  const active = day.records.opportunities
    .filter((o) => o.status !== "closed")
    .toSorted((a, b) => upcoming(a).localeCompare(upcoming(b)));
  const groups: Group[] = active.map((o) => ({
    key: o.id,
    title: o.title,
    meta: [
      day.index.company(o.companyId)?.name,
      o.deadline && o.deadline >= day.today
        ? deadlineText(o.deadline, day.today)
        : STAGE_LABEL[o.status].toLowerCase(),
    ]
      .filter(Boolean)
      .join(" · "),
    people: day.index.peopleOf(o).filter(matches),
  }));
  const inActive = new Set<string>(active.flatMap((o) => o.personIds));
  const past = day.records.people.filter(
    (p) => !inActive.has(p.id) && day.index.opportunitiesOf(p.id).length > 0 && matches(p),
  );
  const unlinked = day.records.people.filter(
    (p) => day.index.opportunitiesOf(p.id).length === 0 && matches(p),
  );
  if (past.length) groups.push({ key: "past", title: "From closed opportunities", people: past });
  if (unlinked.length) groups.push({ key: "unlinked", title: "Not linked yet", people: unlinked });
  return groups.filter((g) => g.people.length > 0);
}

/** People opens on the most recent conversation, which is usually the one you came for. */
export function mostRecentlyActive(day: Day): PersonId | undefined {
  return day.records.interactions.toSorted((a, b) => compareInstants(b.occurredAt, a.occurredAt))[0]
    ?.personId;
}
