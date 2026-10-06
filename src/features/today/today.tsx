"use client";

import type { WorkspaceActions } from "@/features/workspace/outcome";
import type { Workspace } from "@/features/workspace/records";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { useAnnouncer } from "./item-actions";
import s from "./today.module.css";
import { TodayDesktop } from "./today-desktop";
import { TodayPhone } from "./today-phone";
import { useFocus } from "./use-focus";

/**
 * Today, as approved: a desktop composition (the current item beside "Your
 * day") and a phone composition (focus first, then up next, then the rest).
 * They are different layouts, not one squeezed, so both render and CSS shows
 * the one that fits. They share one session, one focus and one announcer, so
 * acting in either is reflected in both.
 *
 * Actions apply the real domain rules and are saved through `actions` before
 * the screen changes.
 */
export function Today({
  workspace,
  actions,
  welcome,
}: {
  workspace: Workspace;
  /** Server Actions in production; see WorkspaceActions. */
  actions: WorkspaceActions;
  /** Said once on arrival, as onboarding ends inside Today. */
  welcome?: string;
}) {
  const day = useWorkspace(workspace, actions);
  const focus = useFocus(day);
  const announcer = useAnnouncer(day, welcome);
  return (
    <>
      <div className={s.desktopLayout} data-layout="desktop">
        <TodayDesktop day={day} focus={focus} announcer={announcer} />
      </div>
      <div className={`${s.phoneLayout} ${s.mobile}`} data-layout="phone">
        <TodayPhone day={day} focus={focus} announcer={announcer} />
      </div>
    </>
  );
}
