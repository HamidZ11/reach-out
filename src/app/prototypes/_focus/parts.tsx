"use client";

import type { CSSProperties, ReactNode } from "react";
import type { PersonId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import type { CalendarDate } from "@/domain/time";
import type { DraftText, Tone } from "@/features/today/wording";
import { lastExchange, statusFor } from "@/features/today/wording";
import { ago, dayOf, shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { SurfaceId } from "../_shared/options";
import type { ItemContext } from "../_shared/snapshot";
import {
  channelNoun,
  firstName,
  initials,
  OUTREACH_LABEL,
  RELATIONSHIP_LABEL,
} from "../_shared/snapshot";
import type { Day } from "../_shared/use-day";
import s from "./focus.module.css";

/** Today's wording and focus state are production code; the prototype re-exports them. */
export type { DraftText, Tone } from "@/features/today/wording";
export {
  channelFor,
  GROUPS,
  headline,
  initialDraft,
  lastExchange,
  personState,
  rowLines,
  stableKey,
  statusFor,
} from "@/features/today/wording";
export { useFocus } from "@/features/today/use-focus";

/* ——— Identity ——— */

const TINTS: [string, string][] = [
  ["#e6ecf3", "#2b4a6b"],
  ["#efe7dc", "#6b4a23"],
  ["#e4efe9", "#245a43"],
  ["#f1e4e1", "#7a3626"],
  ["#e9e6f1", "#463e6e"],
  ["#ece9df", "#55502f"],
];

/** A muted tint chosen from the name, so a person always looks the same. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [bg, ink] = TINTS[hash % TINTS.length] ?? ["#eee", "#222"];
  const style = { "--size": `${size}px`, "--tint-bg": bg, "--tint-ink": ink } as CSSProperties;
  return (
    <span className={s.avatar} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/* ——— App frame: labelled rail on the canvas, content on one sheet ——— */

type NavIcon = (props: { size?: number; weight?: number; filled?: boolean }) => ReactNode;

const NAV: { label: string; icon: NavIcon; surface: SurfaceId }[] = [
  { label: "Today", icon: Icon.Sun, surface: "today" },
  { label: "People", icon: Icon.People, surface: "people" },
  { label: "Pursuing", icon: Icon.Target, surface: "opportunities" },
  { label: "Outreach", icon: Icon.Inbox, surface: "outreach" },
  { label: "Companies", icon: Icon.Building, surface: "companies" },
];

/** Settings sits at the foot of the rail, apart from the work. */
const SETTINGS = { label: "Settings", icon: Icon.Sliders, surface: "settings" } as const;

function NavItem({
  item,
  active,
  day,
  navigate,
}: {
  item: { label: string; icon: NavIcon; surface: SurfaceId };
  active: SurfaceId;
  day: Day;
  navigate: (surface: SurfaceId) => void;
}) {
  const current = item.surface === active;
  return (
    <button
      type="button"
      className={s.navItem}
      aria-current={current ? "page" : undefined}
      onClick={() => navigate(item.surface)}
    >
      <span className={s.navIcon}>
        <item.icon size={20} weight={current ? 2 : 1.75} filled={current} />
        {item.surface === "today" && day.contexts.length > 0 && (
          <span className={s.navDot} aria-hidden="true" />
        )}
      </span>
      {item.label}
    </button>
  );
}

/** Hands a person from Today to People when the user follows a name. */
export const personHandoff: { id?: PersonId } = {};

export function AppFrame({
  active,
  day,
  navigate,
  children,
}: {
  active: SurfaceId;
  day: Day;
  navigate: (surface: SurfaceId) => void;
  children: ReactNode;
}) {
  return (
    <div className={s.root}>
      <div className={s.app}>
        <nav className={s.rail} aria-label="Sections">
          <span className={s.mark} aria-hidden="true">
            r
          </span>
          {NAV.map((item) => (
            <NavItem key={item.surface} item={item} active={active} day={day} navigate={navigate} />
          ))}
          <span className={s.railFoot}>
            <NavItem item={SETTINGS} active={active} day={day} navigate={navigate} />
            <Avatar name={day.user.name} size={34} />
          </span>
        </nav>
        <main className={s.sheet}>{children}</main>
      </div>
    </div>
  );
}

/* ——— Date tile: the day an item is about, coloured by what it means ——— */

export function Tile({
  date,
  icon,
  label,
  tone,
  small = false,
}: {
  date?: CalendarDate;
  icon?: ReactNode;
  label?: string;
  tone: Tone;
  small?: boolean;
}) {
  return (
    <span
      className={small ? `${s.tile} ${s.tileSmall}` : s.tile}
      data-tone={tone}
      aria-hidden="true"
    >
      {date ? (
        <>
          <span className={s.tileLabel}>{shortDay(date).split(" ")[0]}</span>
          <span className={s.tileDay}>{Number(date.slice(8, 10))}</span>
        </>
      ) : (
        <>
          {icon}
          {label && <span className={s.tileLabel}>{label}</span>}
        </>
      )}
    </span>
  );
}

export function tileFor(ctx: ItemContext, day: Day, small = false) {
  const { item } = ctx;
  const size = small ? 15 : 20;
  switch (item.kind) {
    case "overdue_follow_up":
      return <Tile small={small} date={item.dueOn} tone="late" />;
    case "reply_awaiting_response":
      return <Tile small={small} date={dayOf(item.receivedAt, day.user.timeZone)} tone="now" />;
    case "deadline_approaching":
      return (
        <Tile small={small} date={item.deadline} tone={item.daysRemaining <= 1 ? "late" : "now"} />
      );
    case "draft_awaiting_approval":
      return (
        <Tile
          small={small}
          icon={<Icon.Pen size={size} />}
          label={small ? undefined : "Draft"}
          tone="now"
        />
      );
    case "draft_ready_to_send":
      return (
        <Tile
          small={small}
          icon={<Icon.Send size={size} />}
          label={small ? undefined : "Send"}
          tone="good"
        />
      );
    case "upcoming_action": {
      const d = item.daysUntilDue;
      return (
        <Tile small={small} date={item.dueOn} tone={d < 0 ? "late" : d === 0 ? "now" : undefined} />
      );
    }
  }
}

/* ——— Wording lives in production (src/features/today/wording.ts) ——— */

export function Status({ ctx, className }: { ctx: ItemContext; className?: string }) {
  const status = statusFor(ctx);
  return (
    <p className={className}>
      <span className={s.tone} data-tone={status.tone}>
        <span className={s.dot} data-tone={status.tone} aria-hidden="true" />
        {status.text}
      </span>
      {status.detail && <span>{status.detail}</span>}
    </p>
  );
}

/**
 * A person's standing as one line: where outreach is (coloured, with words),
 * the relationship, and when you last spoke. Replaces a row of chips.
 */
export function Standing({
  person,
  day,
  withLastContact = true,
}: {
  person: Person;
  day: Day;
  withLastContact?: boolean;
}) {
  const outreach = day.outreachOf(person.id);
  const tone: Tone =
    outreach === "follow_up_due"
      ? "late"
      : outreach === "replied"
        ? "good"
        : outreach === "draft"
          ? "now"
          : undefined;
  const last = lastExchange(person, day);
  return (
    <p className={s.standing}>
      <span className={s.tone} data-tone={tone}>
        <span className={s.dot} data-tone={tone} aria-hidden="true" />
        <span className="sr-only">Outreach: </span>
        {OUTREACH_LABEL[outreach]}
      </span>
      <span>
        <span className="sr-only">Relationship: </span>
        {RELATIONSHIP_LABEL[person.relationshipStatus]}
      </span>
      {withLastContact && (
        <span>
          {last ? `last contact ${ago(day.index.daysSince(last.occurredAt))}` : "not contacted yet"}
        </span>
      )}
    </p>
  );
}

/** Email and LinkedIn as quiet round actions beside the person. */
export function ContactActions({ person }: { person: Person }) {
  const first = firstName(person.name);
  return (
    <span className={s.contactActions}>
      {person.email && (
        <a
          className={s.iconLink}
          href={`mailto:${person.email}`}
          aria-label={`Email ${first}`}
          title={person.email}
        >
          <Icon.Mail size={18} weight={1.75} />
        </a>
      )}
      {person.linkedinUrl && (
        <a
          className={s.iconLink}
          href={person.linkedinUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${first}'s LinkedIn profile`}
          title="LinkedIn profile"
        >
          <Icon.ArrowUpRight size={18} weight={1.75} />
        </a>
      )}
    </span>
  );
}

/* ——— Composer: controlled, so closing it never throws text away ——— */

export function Composer({
  person,
  channel,
  value,
  onChange,
  onSave,
  saveLabel = "Save as draft",
  editing = false,
}: {
  person: Person;
  channel: "email" | "linkedin" | "other";
  value: DraftText;
  onChange: (value: DraftText) => void;
  onSave: () => void;
  saveLabel?: string;
  editing?: boolean;
}) {
  const needsSubject = channel === "email" && !editing && value.subject.trim() === "";
  const ready = value.body.trim() !== "" && !needsSubject;
  return (
    <div className={s.composer}>
      <div className={s.composerHead}>
        <span>
          To {person.name} · {channelNoun(channel)}
        </span>
        <span>{editing ? "Editing sends it back for approval" : "Saved as a draft"}</span>
      </div>
      {channel === "email" && !editing && (
        <input
          aria-label="Subject"
          placeholder="Subject"
          value={value.subject}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
        />
      )}
      <textarea
        aria-label={`Message to ${person.name}`}
        placeholder={`Write to ${firstName(person.name)} the way you'd say it in person.`}
        value={value.body}
        onChange={(e) => onChange({ ...value, body: e.target.value })}
      />
      <div className={s.composerFoot}>
        <button
          type="button"
          className={`${s.primary} ${s.small}`}
          disabled={!ready}
          onClick={onSave}
        >
          {saveLabel}
        </button>
        <span>
          {needsSubject && value.body.trim() !== ""
            ? "Add a subject to save an email."
            : "Nothing is sent from here."}
        </span>
      </div>
    </div>
  );
}
