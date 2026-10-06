"use client";

import pp from "@/features/people/people.module.css";
import { useAnnouncer } from "@/features/today/item-actions";
import t from "@/features/today/today.module.css";
import type { WorkspaceActions } from "@/features/workspace/outcome";
import type { Workspace } from "@/features/workspace/records";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { OutreachDesktop } from "./outreach-desktop";
import { OutreachPhone } from "./outreach-phone";
import { useTrackInUrl } from "./selection";
import { tracksOf } from "./tracks";

/**
 * Outreach, as approved: every person's correspondence grouped by where it
 * stands. On desktop you act on each track where it sits, beside "How a
 * message moves"; on a phone, the list, then one person at a time. Both
 * compositions render and CSS shows the one that fits, as on the other
 * surfaces. They share one session and one announcer.
 *
 * Nothing is sent from Reachout. Approve, edit and "Mark as sent" run the
 * domain's draft rules and are saved: marking as sent records what you sent
 * yourself.
 */
export function Outreach({
  workspace,
  actions,
}: {
  workspace: Workspace;
  /** Server Actions in production; see WorkspaceActions. */
  actions: WorkspaceActions;
}) {
  const day = useWorkspace(workspace, actions);
  const announcer = useAnnouncer(day);
  const tracks = tracksOf(day);
  const selection = useTrackInUrl(day);
  return (
    <>
      <div className={t.desktopLayout} data-layout="desktop">
        <OutreachDesktop day={day} tracks={tracks} announcer={announcer} selection={selection} />
      </div>
      <div className={`${t.phoneLayout} ${t.mobile} ${pp.mShell}`} data-layout="phone">
        <OutreachPhone day={day} tracks={tracks} announcer={announcer} selection={selection} />
      </div>
    </>
  );
}
