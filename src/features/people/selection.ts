import { PersonIdSchema } from "@/domain/ids";
import { PERSON_PARAM, personHref, SECTIONS } from "@/features/sections";
import { useUrlSelection } from "@/features/workspace/use-url-selection";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { mostRecentlyActive } from "./groups";

/**
 * Which person People shows: the one in the URL (`/people?person=<id>`), so a
 * refresh keeps it and Today can link straight to someone. Both layouts read
 * the same id. Without a valid id, desktop opens on the most recent
 * conversation and a phone shows the list.
 */
export function usePersonInUrl(day: WorkspaceState) {
  return useUrlSelection({
    param: PERSON_PARAM,
    schema: PersonIdSchema,
    find: (id) => day.index.person(id),
    href: personHref,
    listHref: SECTIONS.people.href,
    fallback: () => mostRecentlyActive(day) ?? day.records.people[0]?.id,
  });
}

export type PersonSelection = ReturnType<typeof usePersonInUrl>;
