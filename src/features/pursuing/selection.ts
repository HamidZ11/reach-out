import { OpportunityIdSchema } from "@/domain/ids";
import { OPPORTUNITY_PARAM, opportunityHref, SECTIONS } from "@/features/sections";
import { useUrlSelection } from "@/features/workspace/use-url-selection";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import type { OpportunityGroup } from "./groups";

/**
 * Which opportunity Pursuing shows: the one in the URL
 * (`/opportunities?opportunity=<id>`), so a refresh keeps it and other screens
 * can link straight to it. Without a valid id, desktop opens on whatever closes
 * first and a phone shows the list.
 */
export function useOpportunityInUrl(day: WorkspaceState, groups: OpportunityGroup[]) {
  return useUrlSelection({
    param: OPPORTUNITY_PARAM,
    schema: OpportunityIdSchema,
    find: (id) => day.index.opportunity(id),
    href: opportunityHref,
    listHref: SECTIONS.opportunities.href,
    fallback: () => groups[0]?.items[0]?.id,
  });
}

export type OpportunitySelection = ReturnType<typeof useOpportunityInUrl>;
