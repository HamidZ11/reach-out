"use client";

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
 * Actions apply the real domain rules to this session only. Nothing is saved
 * yet: the Repository gains writes with the first write path (ROADMAP phase 2).
 */
export function Today({ workspace }: { workspace: Workspace }) {
  const day = useWorkspace(workspace);
  const focus = useFocus(day);
  const announcer = useAnnouncer(day);
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
