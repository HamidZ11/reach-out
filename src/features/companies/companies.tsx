"use client";

import pp from "@/features/people/people.module.css";
import t from "@/features/today/today.module.css";
import type { WorkspaceActions } from "@/features/workspace/outcome";
import type { Workspace } from "@/features/workspace/records";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { orderedCompanies } from "./aggregate";
import { CompaniesDesktop } from "./companies-desktop";
import { CompaniesPhone } from "./companies-phone";
import { useCompanyInUrl } from "./selection";

/**
 * Companies, as approved: derived and light (D-012). On desktop, every
 * company you have something at beside the selected one; on a phone, the list
 * then one company, or the company an opportunity opened. Nothing here is
 * entered or edited: it gathers what Pursuing, People and Outreach already know.
 */
export function Companies({
  workspace,
  actions,
}: {
  workspace: Workspace;
  /** Server Actions in production; see WorkspaceActions. */
  actions: WorkspaceActions;
}) {
  const day = useWorkspace(workspace, actions);
  const ordered = orderedCompanies(day);
  const selection = useCompanyInUrl(day, ordered);
  return (
    <>
      <div className={t.desktopLayout} data-layout="desktop">
        <CompaniesDesktop day={day} ordered={ordered} selection={selection} />
      </div>
      <div className={`${t.phoneLayout} ${t.mobile} ${pp.mShell}`} data-layout="phone">
        <CompaniesPhone day={day} ordered={ordered} selection={selection} />
      </div>
    </>
  );
}
