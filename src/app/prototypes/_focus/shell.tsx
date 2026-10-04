"use client";

import type { ReactNode } from "react";
import * as Icon from "../_shared/icons";
import type { SurfaceId } from "../_shared/options";
import type { Day } from "../_shared/use-day";
import s from "./focus.module.css";
import { Avatar } from "./parts";
import k from "./surfaces.module.css";

type TabIcon = (props: { size?: number; weight?: number; filled?: boolean }) => ReactNode;

/**
 * The approved bottom bar: the four places you go every day. Companies opens
 * from an opportunity and Settings from your avatar, so the bar stays at four.
 */
const TABS: { label: string; icon: TabIcon; surface?: SurfaceId }[] = [
  { label: "Today", icon: Icon.Sun, surface: "today" },
  { label: "People", icon: Icon.People, surface: "people" },
  { label: "Pursuing", icon: Icon.Target, surface: "opportunities" },
  { label: "Outreach", icon: Icon.Inbox, surface: "outreach" },
];

export function MobileTabs({
  active,
  navigate,
}: {
  active?: SurfaceId;
  navigate: (surface: SurfaceId) => void;
}) {
  return (
    <nav className={s.mTabs} aria-label="Sections">
      {TABS.map((t) => {
        const current = t.surface !== undefined && t.surface === active;
        const inner = (
          <>
            <span className={s.mTabIcon}>
              <t.icon size={19} weight={current ? 2 : 1.75} filled={current} />
            </span>
            {t.label}
          </>
        );
        return t.surface ? (
          <button
            key={t.label}
            type="button"
            className={s.mTab}
            aria-current={current ? "page" : undefined}
            onClick={() => t.surface && navigate(t.surface)}
          >
            {inner}
          </button>
        ) : (
          <span
            key={t.label}
            className={s.mTab}
            aria-disabled="true"
            title={`${t.label} on a phone isn't designed yet`}
          >
            {inner}
          </span>
        );
      })}
    </nav>
  );
}

/** Your avatar in the top bar opens Settings, which has no tab of its own. */
export function SettingsButton({
  day,
  navigate,
}: {
  day: Day;
  navigate: (surface: SurfaceId) => void;
}) {
  return (
    <button
      type="button"
      className={k.mAvatar}
      aria-label="Settings"
      onClick={() => navigate("settings")}
    >
      <Avatar name={day.user.name} size={32} />
    </button>
  );
}

/**
 * The phone frame every surface after Today shares: the approved top bar,
 * heading and bottom bar, with the surface's own content between them.
 */
export function MobileShell({
  day,
  navigate,
  active,
  title,
  subtitle,
  back,
  leading,
  trailing,
  tight = false,
  detail = false,
  toast,
  overlay,
  children,
}: {
  day: Day;
  navigate: (surface: SurfaceId) => void;
  active?: SurfaceId;
  title: string;
  subtitle?: ReactNode;
  back?: { label: string; onClick: () => void };
  /** Beside the title: a person's avatar or a company's mark. */
  leading?: ReactNode;
  /** At the end of the title row: a person's contact buttons. */
  trailing?: ReactNode;
  /** A person's page: a shorter header, so their story starts sooner. */
  tight?: boolean;
  /** A drilled-in page: a smaller title that can wrap, under a Back button. */
  detail?: boolean;
  toast?: ReactNode;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${s.root} ${s.mobile} ${k.mShell}`}>
      <div className={`${s.mScroll} ${s.scroll}`}>
        <div className={s.mTop}>
          {back ? (
            <button
              type="button"
              className={k.mBack}
              aria-label={`Back to ${back.label}`}
              onClick={back.onClick}
            >
              <Icon.ArrowLeft size={18} weight={2} />
              {back.label}
            </button>
          ) : (
            <span className={s.mMark} aria-hidden="true">
              r
            </span>
          )}
          <SettingsButton day={day} navigate={navigate} />
        </div>
        <header
          className={[
            s.mHeading,
            leading && k.mHeadingLead,
            trailing && k.mHeadingTrail,
            tight && k.mHeadingTight,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {leading}
          <div className={k.mHeadingText}>
            <h1
              className={detail ? `${k.mDetailTitle}${tight ? ` ${k.mTightTitle}` : ""}` : s.mTitle}
            >
              {title}
            </h1>
            {subtitle && (
              <span className={tight ? `${s.mDate} ${k.mTightSub}` : s.mDate}>{subtitle}</span>
            )}
          </div>
          {trailing}
        </header>
        <div className={s.mBody}>{children}</div>
        {toast}
      </div>
      <MobileTabs active={active} navigate={navigate} />
      {overlay}
    </div>
  );
}
