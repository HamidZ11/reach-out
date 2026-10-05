"use client";

import { useAnnouncer } from "@/features/today/item-actions";
import t from "@/features/today/today.module.css";
import type { Workspace } from "@/features/workspace/records";
import { useWorkspace } from "@/features/workspace/use-workspace";
import p from "./people.module.css";
import { PeopleDesktop } from "./people-desktop";
import { PeoplePhone } from "./people-phone";
import { usePersonInUrl } from "./selection";

/**
 * People, as approved: on desktop an opportunity-grouped list beside the
 * selected person; on a phone the list, then one person at a time. Both
 * compositions render and CSS shows the one that fits, as on Today. They share
 * one session, one announcer and one selected person — the one in the URL —
 * so acting in either is reflected in both.
 *
 * Actions are Today's, applied by the real domain rules to this session only.
 * Nothing is saved yet: the Repository gains writes in ROADMAP phase 2.
 */
export function People({ workspace }: { workspace: Workspace }) {
  const day = useWorkspace(workspace);
  const announcer = useAnnouncer(day);
  const selection = usePersonInUrl(day);
  return (
    <>
      <div className={t.desktopLayout} data-layout="desktop">
        <PeopleDesktop day={day} announcer={announcer} selection={selection} />
      </div>
      <div className={`${t.phoneLayout} ${t.mobile} ${p.mShell}`} data-layout="phone">
        <PeoplePhone day={day} announcer={announcer} selection={selection} />
      </div>
    </>
  );
}
