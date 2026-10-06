"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import * as Icon from "@/components/icons";
import { OpportunityIdSchema } from "@/domain/ids";
import { FROM_PARAM, SECTIONS } from "@/features/sections";
import s from "./app-shell.module.css";

type NavIcon = (props: { size?: number; weight?: number; filled?: boolean }) => ReactNode;
type NavItem = { label: string; href: Route; icon: NavIcon };

/** The rail's labels are the approved design's ("Pursuing" for opportunities). */
const RAIL: NavItem[] = [
  { label: "Today", href: SECTIONS.today.href, icon: Icon.Sun },
  { label: "People", href: SECTIONS.people.href, icon: Icon.People },
  { label: "Pursuing", href: SECTIONS.opportunities.href, icon: Icon.Target },
  { label: "Outreach", href: SECTIONS.outreach.href, icon: Icon.Inbox },
  { label: "Companies", href: SECTIONS.companies.href, icon: Icon.Building },
];

/** Settings sits at the foot of the rail, apart from the work. */
const SETTINGS: NavItem = { label: "Settings", href: SECTIONS.settings.href, icon: Icon.Sliders };

/** The four places you go every day. Companies is contextual; Settings opens from the avatar. */
const TABS: NavItem[] = RAIL.slice(0, 4);

function isCurrent(pathname: string | null, href: Route) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

function RailLink({
  item,
  current,
  attention,
}: {
  item: NavItem;
  current: boolean;
  attention: boolean;
}) {
  return (
    <Link href={item.href} className={s.navItem} aria-current={current ? "page" : undefined}>
      <span className={s.navIcon}>
        <item.icon size={20} weight={current ? 2 : 1.75} filled={current} />
        {attention && <span className={s.navDot} aria-hidden="true" />}
      </span>
      {item.label}
      {attention && <span className="sr-only">, something needs you</span>}
    </Link>
  );
}

/**
 * The signed-in application shell. `attention` lights the marigold dot on
 * Today when something there needs the user.
 */
export function AppShell({
  userName,
  attention,
  children,
}: {
  userName: string;
  attention: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  // Companies has no tab: opened from an opportunity, the bar keeps Pursuing marked.
  const fromOpportunity =
    isCurrent(pathname, SECTIONS.companies.href) &&
    OpportunityIdSchema.safeParse(params.get(FROM_PARAM)).success;
  return (
    <div className={s.shell}>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <nav className={s.rail} aria-label="Sections">
        <span className={s.mark} aria-hidden="true">
          r
        </span>
        {RAIL.map((item) => (
          <RailLink
            key={item.href}
            item={item}
            current={isCurrent(pathname, item.href)}
            attention={attention && item.href === SECTIONS.today.href}
          />
        ))}
        <span className={s.railFoot}>
          <RailLink
            item={SETTINGS}
            current={isCurrent(pathname, SETTINGS.href)}
            attention={false}
          />
          <Avatar name={userName} size={34} />
        </span>
      </nav>

      <main id="main" className={s.sheet}>
        {children}
      </main>

      <nav className={s.tabs} aria-label="Sections">
        {TABS.map((item) => {
          const current =
            isCurrent(pathname, item.href) ||
            (fromOpportunity && item.href === SECTIONS.opportunities.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={s.tab}
              aria-current={current ? "page" : undefined}
            >
              <span className={s.tabIcon}>
                <item.icon size={19} weight={current ? 2 : 1.75} filled={current} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
