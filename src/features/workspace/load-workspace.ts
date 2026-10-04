import type { Repository } from "@/data/repository";
import type { Subject } from "@/domain/research";
import { calendarDateIn, instant } from "@/domain/time";
import type { Workspace } from "./records";

/**
 * Reads one user's records through any Repository. The caller supplies the
 * clock (`now`), so loaders and the domain never read it themselves.
 *
 * Research context (facts and interpretations) is read only when a screen
 * shows it; Today does not.
 */
export async function loadWorkspace(
  repository: Repository,
  now: Date,
  { research = false }: { research?: boolean } = {},
): Promise<Workspace> {
  const user = await repository.user.get();
  const [companies, people, opportunities, interactions, drafts, nextActions] = await Promise.all([
    repository.companies.list(),
    repository.people.list(),
    repository.opportunities.list(),
    repository.interactions.list(),
    repository.drafts.list(),
    repository.nextActions.list(),
  ]);

  const subjects: Subject[] = research
    ? [
        ...people.map((p) => ({ type: "person" as const, id: p.id })),
        ...companies.map((c) => ({ type: "company" as const, id: c.id })),
        ...opportunities.map((o) => ({ type: "opportunity" as const, id: o.id })),
      ]
    : [];
  const [facts, interpretations] = await Promise.all([
    Promise.all(subjects.map((s) => repository.research.facts(s))),
    Promise.all(subjects.map((s) => repository.research.interpretations(s))),
  ]);

  return {
    now: instant(now.toISOString()),
    today: calendarDateIn(now, user.timeZone),
    user,
    companies,
    people,
    opportunities,
    interactions,
    drafts,
    nextActions,
    facts: facts.flat(),
    interpretations: interpretations.flat(),
  };
}
