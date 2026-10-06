import { useSearchParams } from "next/navigation";
import { CompanyIdSchema, OpportunityIdSchema } from "@/domain/ids";
import type { Opportunity } from "@/domain/opportunity";
import { COMPANY_PARAM, companyHref, FROM_PARAM, SECTIONS } from "@/features/sections";
import { useUrlSelection } from "@/features/workspace/use-url-selection";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import type { CompanyView } from "./aggregate";

/**
 * Which company Companies shows: the one in the URL
 * (`/companies?company=<id>`). Without a valid id, desktop opens on the first
 * company and a phone shows the list.
 */
export function useCompanyInUrl(day: WorkspaceState, ordered: CompanyView[]) {
  const selection = useUrlSelection({
    param: COMPANY_PARAM,
    schema: CompanyIdSchema,
    find: (id) => day.index.company(id),
    href: (id) => companyHref(id),
    listHref: SECTIONS.companies.href,
    fallback: () => ordered[0]?.company.id,
  });
  const params = useSearchParams();
  return { ...selection, cameFrom: cameFrom(params, day, selection.requested?.id) };
}

/**
 * A company opened from an opportunity on a phone goes Back to it
 * (`?company=<id>&from=<opportunity-id>`). The opportunity must exist and be
 * at this company; anything else is ignored, and Back returns to Companies.
 */
export function cameFrom(
  params: Pick<URLSearchParams, "get">,
  day: Pick<WorkspaceState, "index">,
  companyId: string | undefined,
): Opportunity | undefined {
  const parsed = OpportunityIdSchema.safeParse(params.get(FROM_PARAM));
  if (!parsed.success || !companyId) return undefined;
  const opportunity = day.index.opportunity(parsed.data);
  return opportunity?.companyId === companyId ? opportunity : undefined;
}

export type CompanySelection = ReturnType<typeof useCompanyInUrl>;
