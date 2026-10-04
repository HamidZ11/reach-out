import "server-only";
import type { Subject } from "@/domain/research";
import { calendarDateIn, instant } from "@/domain/time";
import { getRepository } from "@/server/repository";
import type { Snapshot } from "./snapshot";

/** Reads the session user's records through the Repository — the same path production will use. */
export async function loadSnapshot(now = new Date()): Promise<Snapshot> {
  const repository = await getRepository();
  const user = await repository.user.get();
  const [companies, people, opportunities, interactions, drafts, nextActions] = await Promise.all([
    repository.companies.list(),
    repository.people.list(),
    repository.opportunities.list(),
    repository.interactions.list(),
    repository.drafts.list(),
    repository.nextActions.list(),
  ]);

  const subjects: Subject[] = [
    ...people.map((p) => ({ type: "person" as const, id: p.id })),
    ...companies.map((c) => ({ type: "company" as const, id: c.id })),
    ...opportunities.map((o) => ({ type: "opportunity" as const, id: o.id })),
  ];
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
