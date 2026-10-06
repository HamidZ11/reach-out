import type { Repository } from "@/data/repository";
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
  const [user, companies, people, opportunities, interactions, drafts, nextActions] =
    await Promise.all([
      repository.user.get(),
      repository.companies.list(),
      repository.people.list(),
      repository.opportunities.list(),
      repository.interactions.list(),
      repository.drafts.list(),
      repository.nextActions.list(),
    ]);

  // One read each, not one per subject: a subject's facts keep their order.
  const [facts, interpretations] = research
    ? await Promise.all([repository.research.facts(), repository.research.interpretations()])
    : [[], []];

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
    facts,
    interpretations,
  };
}
