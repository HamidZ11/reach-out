import { ago } from "@/components/dates";
import type { Company } from "@/domain/company";
import { isPendingDraft } from "@/domain/draft";
import type { Person } from "@/domain/person";
import { compareInstants } from "@/domain/time";
import { peopleCount } from "@/features/pursuing/wording";
import { liveDeadline } from "@/features/today/date-tile";
import { countWord, firstName } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";

/**
 * Companies are derived context, never a database to maintain (D-012): each
 * one gathers what you're pursuing there, who you know, and what has happened,
 * from the records that already say so. Nothing here is stored or scored.
 */

export type CompanyView = ReturnType<typeof gather>;

export function gather(c: Company, day: WorkspaceState) {
  const opportunities = day.records.opportunities.filter((o) => o.companyId === c.id);
  const active = opportunities.filter((o) => o.status !== "closed");
  const people = day.records.people.filter((p) => p.companyId === c.id);
  const personIds = new Set<string>(people.map((p) => p.id));
  const opportunityIds = new Set<string>(opportunities.map((o) => o.id));
  const interactions = day.records.interactions.filter(
    (i) =>
      personIds.has(i.personId) ||
      (i.opportunityId !== undefined && opportunityIds.has(i.opportunityId)),
  );
  const drafts = day.records.drafts.filter((d) => personIds.has(d.personId) && isPendingDraft(d));
  const latest = interactions.toSorted((a, b) => compareInstants(b.occurredAt, a.occurredAt))[0];
  // The first thing Today asks of you here, about an opportunity or a person.
  const ctx = day.contexts.find(
    (x) =>
      (x.opportunity && opportunityIds.has(x.opportunity.id)) ||
      (x.person && personIds.has(x.person.id)),
  );
  const deadline = active
    .map((o) => liveDeadline(o, day.today))
    .filter((d) => d !== undefined)
    .toSorted()[0];
  // Active first, then the closed ones, as they read on the page.
  const pursued = [...active, ...opportunities.filter((o) => o.status === "closed")];
  return {
    company: c,
    opportunities,
    active,
    pursued,
    people,
    interactions,
    drafts,
    latest,
    ctx,
    deadline,
  };
}

/** Companies with something closing first, then what Today asks soonest, then the most recently active. */
export function orderedCompanies(day: WorkspaceState): CompanyView[] {
  const rank = (view: CompanyView) => (view.ctx ? day.contexts.indexOf(view.ctx) : Infinity);
  return day.records.companies
    .map((c) => gather(c, day))
    .toSorted(
      (x, y) =>
        (x.deadline ?? "9999").localeCompare(y.deadline ?? "9999") ||
        rank(x) - rank(y) ||
        (x.latest && y.latest
          ? compareInstants(y.latest.occurredAt, x.latest.occurredAt)
          : x.latest
            ? -1
            : y.latest
              ? 1
              : 0) ||
        x.company.name.localeCompare(y.company.name),
    );
}

/** Your strongest tie there, in words. Relationship first, never a score. */
function tieClause(people: Person[], day: WorkspaceState): string {
  const by = (status: Person["relationshipStatus"]) =>
    people.find((p) => p.relationshipStatus === status);
  const warm = by("warm");
  if (warm) return `you're on good terms with ${firstName(warm.name)}`;
  const replied = by("replied");
  if (replied) return `${firstName(replied.name)} has replied`;
  const drafted = people.find((p) => day.outreachOf(p.id) === "draft");
  if (drafted) return `your draft to ${firstName(drafted.name)} is waiting`;
  const contacted = by("contacted");
  if (contacted) return `you've written to ${firstName(contacted.name)}`;
  const dormant = by("dormant");
  if (dormant) return `it's gone quiet with ${firstName(dormant.name)}`;
  return "you haven't been in touch yet";
}

/** Why this company matters, said from the records: what you pursue and who you know. */
export function whyLine(view: CompanyView, day: WorkspaceState): string {
  const { active, people } = view;
  const pursuing =
    active.length === 0
      ? "Nothing is active here right now"
      : active.length === 1
        ? `You're pursuing “${active[0]?.title}” here`
        : `You're pursuing ${countWord(active.length)} things here`;
  const knowing =
    people.length === 0
      ? "but you don't know anyone there yet"
      : `and know ${people.length === 1 ? "one person" : `${countWord(people.length)} people`} — ${tieClause(people, day)}`;
  return `${pursuing}, ${knowing}.`;
}

/** The company's standing as one line of parts. */
export function standingParts(view: CompanyView, day: WorkspaceState): string[] {
  return [
    view.active.length === 1
      ? "1 active opportunity"
      : `${view.active.length} active opportunities`,
    peopleCount(view.people.length),
    view.latest
      ? `last contact ${ago(day.index.daysSince(view.latest.occurredAt))}`
      : "no contact yet",
  ];
}
