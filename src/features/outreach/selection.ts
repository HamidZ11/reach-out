import { PersonIdSchema } from "@/domain/ids";
import { outreachHref, PERSON_PARAM, SECTIONS } from "@/features/sections";
import { useUrlSelection } from "@/features/workspace/use-url-selection";
import type { WorkspaceState } from "@/features/workspace/use-workspace";

/**
 * Which track Outreach opens: the person in the URL (`/outreach?person=<id>`).
 * One track per person (D-014), so the person's id names it. On a phone it is
 * the open page; on desktop, where every track is acted on in place, the page
 * scrolls to it. Without a valid id, a phone shows the list.
 */
export function useTrackInUrl(day: WorkspaceState) {
  return useUrlSelection({
    param: PERSON_PARAM,
    schema: PersonIdSchema,
    find: (id) => day.index.person(id),
    href: outreachHref,
    listHref: SECTIONS.outreach.href,
    fallback: () => undefined,
  });
}

export type TrackSelection = ReturnType<typeof useTrackInUrl>;
