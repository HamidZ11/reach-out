"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { PersonId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import type { CalendarDate } from "@/domain/time";
import { ago, dayCount, dayOf, longDay, shortDay, weekday } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { SurfaceId } from "../_shared/options";
import type { ItemContext } from "../_shared/snapshot";
import {
  channelNoun,
  channelOf,
  firstName,
  initials,
  OUTREACH_LABEL,
  RELATIONSHIP_LABEL,
} from "../_shared/snapshot";
import type { Day } from "../_shared/use-day";
import s from "./focus.module.css";

export type Tone = "late" | "now" | "good" | undefined;

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

/* ——— Wording ——— */

/** What the item asks of you, in one line. It is the heading itself, never a label above one. */
export function headline(ctx: ItemContext): string {
  const { item, person, opportunity, action, draft } = ctx;
  const first = person ? firstName(person.name) : "them";
  const channel = draft ? channelNoun(draft.channel) : "message";
  switch (item.kind) {
    case "overdue_follow_up":
    case "upcoming_action":
      return action?.title ?? "Next step";
    case "reply_awaiting_response":
      return `${person?.name ?? "Someone"} replied`;
    case "deadline_approaching":
      return `${opportunity?.title ?? "An opportunity"} closes ${
        item.daysRemaining === 0
          ? "today"
          : item.daysRemaining === 1
            ? "tomorrow"
            : `on ${weekday(item.deadline)}`
      }`;
    case "draft_awaiting_approval":
      return `Approve your ${channel} to ${first}`;
    case "draft_ready_to_send":
      return `Send your ${channel} to ${first}`;
  }
}

/** Relative status with the absolute date beside it. */
export function statusFor(ctx: ItemContext): { tone: Tone; text: string; detail?: string } {
  const { item, draft, message } = ctx;
  switch (item.kind) {
    case "overdue_follow_up":
      return {
        tone: "late",
        text: `${dayCount(item.daysOverdue)} overdue`,
        detail: `due ${shortDay(item.dueOn)}`,
      };
    case "reply_awaiting_response":
      return {
        tone: "now",
        text: `Replied ${ago(-ctx.days)}`,
        detail: `${channelOf(message) ?? "Message"} · your turn`,
      };
    case "deadline_approaching":
      return {
        tone: item.daysRemaining <= 1 ? "late" : "now",
        text:
          item.daysRemaining === 0 ? "Closes today" : `Closes in ${dayCount(item.daysRemaining)}`,
        detail: longDay(item.deadline),
      };
    case "draft_awaiting_approval":
      return {
        tone: "now",
        text: "Waiting for your approval",
        detail: `${draft ? channelNoun(draft.channel) : "Message"} · nothing is sent until you approve it`,
      };
    case "draft_ready_to_send":
      return {
        tone: "good",
        text: "Approved, not sent yet",
        detail:
          draft?.channel === "linkedin"
            ? "Send it on LinkedIn, then mark it as sent"
            : "Send it from your email, then mark it as sent",
      };
    case "upcoming_action": {
      const d = item.daysUntilDue;
      return {
        tone: d < 0 ? "late" : d === 0 ? "now" : undefined,
        text:
          d < 0
            ? `${dayCount(d)} overdue`
            : d === 0
              ? "Due today"
              : d === 1
                ? "Due tomorrow"
                : `Due in ${d} days`,
        detail: shortDay(item.dueOn),
      };
    }
  }
}

/** Day-list rows lead with the person, then what they need from you. */
export function rowLines(ctx: ItemContext): { primary: string; secondary: string } {
  const { item, person, company, opportunity, action } = ctx;
  if (item.kind === "deadline_approaching") {
    return {
      primary: opportunity?.title ?? "Opportunity",
      secondary: `${company ? `${company.name} · ` : ""}closes ${shortDay(item.deadline)}`,
    };
  }
  const secondary =
    item.kind === "reply_awaiting_response"
      ? "Replied — your turn"
      : item.kind === "draft_awaiting_approval"
        ? "Draft waiting for your approval"
        : item.kind === "draft_ready_to_send"
          ? "Approved — ready to send"
          : (action?.title ?? "Next step");
  return { primary: person?.name ?? opportunity?.title ?? "Next step", secondary };
}

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

/** What a person in a list needs from you today, in one or two words. */
export function personState(
  ctx: ItemContext | undefined,
  person: Person,
): { text: string; tone: Tone } {
  if (!ctx) return { text: RELATIONSHIP_LABEL[person.relationshipStatus], tone: undefined };
  switch (ctx.item.kind) {
    case "overdue_follow_up":
      return { text: "Overdue", tone: "late" };
    case "reply_awaiting_response":
      return { text: "Your turn", tone: "now" };
    case "draft_awaiting_approval":
      return { text: "Draft", tone: "now" };
    case "draft_ready_to_send":
      return { text: "To send", tone: "good" };
    case "upcoming_action": {
      const d = ctx.item.daysUntilDue;
      return {
        text:
          d < 0
            ? "Overdue"
            : d === 0
              ? "Today"
              : d === 1
                ? "Tomorrow"
                : (shortDay(ctx.item.dueOn).split(" ")[0] ?? "Soon"),
        tone: d < 0 ? "late" : undefined,
      };
    }
    case "deadline_approaching":
      return { text: "Deadline", tone: "now" };
  }
}

/** The most recent exchange (not a note) with a person. */
export function lastExchange(person: Person, day: Day) {
  return day.index
    .historyOf(person.id)
    .filter((i) => i.kind !== "note")
    .at(-1);
}

/* ——— Composer: controlled, so closing it never throws text away ——— */

export type DraftText = { subject: string; body: string };

export function initialDraft(ctx: ItemContext | undefined): DraftText {
  const m = ctx?.message;
  const subject =
    m && (m.kind === "message_sent" || m.kind === "message_received") && m.subject
      ? `Re: ${m.subject.replace(/^Re:\s*/, "")}`
      : "";
  return { subject, body: ctx?.draft?.body ?? "" };
}

export function channelFor(person: Person, ctx?: ItemContext): "email" | "linkedin" | "other" {
  if (ctx?.draft) return ctx.draft.channel;
  const m = ctx?.message;
  if (m && (m.kind === "message_sent" || m.kind === "message_received")) return m.channel;
  return person.preferredChannel ?? (person.email ? "email" : "linkedin");
}

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

/* ——— Focus state for Today ——— */

/** Drafts keep one identity while their status changes, so approving doesn't lose your place. */
export function stableKey(ctx: ItemContext): string {
  const { item } = ctx;
  return item.kind === "draft_awaiting_approval" || item.kind === "draft_ready_to_send"
    ? `draft:${item.draftId}`
    : ctx.key;
}

export function useFocus(day: Day) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const contexts = day.contexts;
  const current =
    contexts.find((c) => stableKey(c) === chosen) ??
    contexts.find((c) => !skipped.includes(stableKey(c))) ??
    contexts[0];
  const index = current ? contexts.indexOf(current) : -1;
  const next = contexts.filter((c) => c !== current && !skipped.includes(stableKey(c)))[0];
  return {
    current,
    next,
    position: index + 1,
    choose: (ctx: ItemContext) => setChosen(stableKey(ctx)),
    step: (delta: number) => {
      const target = contexts[index + delta];
      if (target) setChosen(stableKey(target));
    },
    skip: () => {
      if (!current) return;
      const remaining = contexts.filter((c) => c !== current && !skipped.includes(stableKey(c)));
      setSkipped(remaining.length ? [...skipped, stableKey(current)] : []);
      setChosen(null);
    },
  };
}

export const GROUPS: { tiers: number[]; label: string }[] = [
  { tiers: [1, 2, 3], label: "Needs you" },
  { tiers: [4], label: "Approve and send" },
  { tiers: [5], label: "Coming up" },
];
