"use client";

import pp from "@/features/people/people.module.css";
import { useAnnouncer } from "@/features/today/item-actions";
import t from "@/features/today/today.module.css";
import type { WorkspaceActions } from "@/features/workspace/outcome";
import type { Workspace } from "@/features/workspace/records";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { opportunityGroups } from "./groups";
import { PursuingDesktop } from "./pursuing-desktop";
import { PursuingPhone } from "./pursuing-phone";
import { useOpportunityInUrl } from "./selection";

/**
 * Pursuing, as approved: on desktop the opportunities grouped by timing beside
 * the selected one; on a phone the list, then one opportunity at a time. Both
 * compositions render and CSS shows the one that fits, as on Today and People.
 * They share one session, one announcer and one selected opportunity — the one
 * in the URL.
 *
 * Actions are Today's: the real domain rules, saved through `actions`.
 */
export function Pursuing({
  workspace,
  actions,
}: {
  workspace: Workspace;
  /** Server Actions in production; see WorkspaceActions. */
  actions: WorkspaceActions;
}) {
  const day = useWorkspace(workspace, actions);
  const announcer = useAnnouncer(day);
  const groups = opportunityGroups(day);
  const selection = useOpportunityInUrl(day, groups);
  return (
    <>
      <div className={t.desktopLayout} data-layout="desktop">
        <PursuingDesktop day={day} groups={groups} announcer={announcer} selection={selection} />
      </div>
      <div className={`${t.phoneLayout} ${t.mobile} ${pp.mShell}`} data-layout="phone">
        <PursuingPhone day={day} groups={groups} announcer={announcer} selection={selection} />
      </div>
    </>
  );
}
