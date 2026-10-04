"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { Draft } from "@/domain/draft";
import type { CompanyId, OpportunityId, PersonId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import type {
  ClosedReason,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
} from "@/domain/opportunity";
import { isPreApplication, OPPORTUNITY_STATUSES, priorityRank } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import type { NextAction } from "@/domain/next-action";
import type { SourceFact } from "@/domain/research";
import type { CalendarDate } from "@/domain/time";
import { TODAY_RULES } from "@/domain/today";
import { clock, dayOf, delta, shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { SurfaceId } from "../_shared/options";
import type { ItemContext } from "../_shared/snapshot";
import { channelOf, firstName, PROVENANCE_LABEL, STAGE_LABEL } from "../_shared/snapshot";
import type { Day } from "../_shared/use-day";
import type { ActionSpec, Announce } from "./actions";
import { ActionButton, useItemActions } from "./actions";
import s from "./focus.module.css";
import type { Tone } from "./parts";
import { Avatar, headline, personHandoff, Standing, Status, Tile, tileFor } from "./parts";
import k from "./surfaces.module.css";

/** Hand a selection to another surface when the user follows a link, as People does. */
export const opportunityHandoff: { id?: OpportunityId } = {};
/** `from`: the opportunity a phone came from, so Back can return to it. */
export const companyHandoff: { id?: CompanyId; from?: OpportunityId } = {};

type Navigate = (surface: SurfaceId) => void;

export function goToPerson(navigate: Navigate, id: PersonId) {
  personHandoff.id = id;
  navigate("people");
}

export function goToOpportunity(navigate: Navigate, id: OpportunityId) {
  opportunityHandoff.id = id;
  navigate("opportunities");
}

export function goToCompany(navigate: Navigate, id: CompanyId, from?: OpportunityId) {
  companyHandoff.id = id;
  companyHandoff.from = from;
  navigate("companies");
}

/* ——— Wording ——— */

export const TYPE_LABEL: Record<OpportunityType, string> = {
  internship: "Internship",
  graduate_role: "Graduate role",
  startup_role: "Startup role",
  research: "Research",
  mentorship: "Mentorship",
  referral: "Referral",
  other: "Opportunity",
};

export const CLOSED_LABEL: Record<ClosedReason, string> = {
  accepted: "Accepted",
  declined: "You declined",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_response: "No response",
  expired: "Expired",
};

/** "no one yet", "1 person", "3 people" */
export function peopleCount(n: number): string {
  return n === 0 ? "no one yet" : n === 1 ? "1 person" : `${n} people`;
}

const weekdayOf = (date: CalendarDate) => shortDay(date).split(" ")[0] ?? "";

/* ——— Opportunities: what needs you, and when it closes ——— */

/** A deadline is worth a tile only before applying, and only while it's still ahead. */
export function liveDeadline(o: Opportunity, today: CalendarDate): CalendarDate | undefined {
  return isPreApplication(o) && o.deadline && o.deadline >= today ? o.deadline : undefined;
}

/** Coloured with the same window Today uses for deadlines. */
export function deadlineTone(deadline: CalendarDate, today: CalendarDate): Tone {
  const d = delta(today, deadline);
  return d <= 1 ? "late" : d <= TODAY_RULES.deadlineWindowDays ? "now" : undefined;
}

/** The first thing Today asks of you about this opportunity, if anything. */
export function contextFor(o: Opportunity, day: Day): ItemContext | undefined {
  return day.contexts.find((c) => c.opportunity?.id === o.id);
}

/** What an item needs from you, in a word or two. */
export function itemState(ctx: ItemContext): { text: string; tone: Tone } {
  const { item } = ctx;
  switch (item.kind) {
    case "overdue_follow_up":
      return { text: "Overdue", tone: "late" };
    case "reply_awaiting_response":
      return { text: "Your turn", tone: "now" };
    case "deadline_approaching":
      return {
        text: item.daysRemaining === 0 ? "Closes today" : `Closes ${weekdayOf(item.deadline)}`,
        tone: item.daysRemaining <= 1 ? "late" : "now",
      };
    case "draft_awaiting_approval":
      return { text: "Draft", tone: "now" };
    case "draft_ready_to_send":
      return { text: "To send", tone: "good" };
    case "upcoming_action": {
      const d = item.daysUntilDue;
      return {
        text: d < 0 ? "Overdue" : d === 0 ? "Today" : d === 1 ? "Tomorrow" : weekdayOf(item.dueOn),
        tone: d < 0 ? "late" : undefined,
      };
    }
  }
}

/** Open next actions for an opportunity, soonest first. */
export function openActionsOf(o: Opportunity, day: Day): NextAction[] {
  return day.records.nextActions
    .filter((a) => a.status === "open" && a.opportunityId === o.id)
    .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export type OpportunityGroup = { key: string; label: string; items: Opportunity[] };

/** Closing soon (Today's deadline window), then the rest in progress, then closed. */
export function opportunityGroups(day: Day): OpportunityGroup[] {
  const { today } = day;
  const all = day.records.opportunities;
  const soon = all
    .filter((o) => {
      const deadline = liveDeadline(o, today);
      return deadline !== undefined && delta(today, deadline) <= TODAY_RULES.deadlineWindowDays;
    })
    .toSorted((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const rest = all
    .filter((o) => o.status !== "closed" && !soon.includes(o))
    .toSorted(
      (a, b) =>
        priorityRank(a) - priorityRank(b) ||
        (liveDeadline(a, today) ?? "9999").localeCompare(liveDeadline(b, today) ?? "9999") ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const closed = all.filter((o) => o.status === "closed");
  return [
    { key: "soon", label: "Closing soon", items: soon },
    { key: "progress", label: "In progress", items: rest },
    { key: "closed", label: "Closed", items: closed },
  ].filter((g) => g.items.length > 0);
}

/* ——— Where you are: the domain's stages as a quiet path, in the history's own
   vocabulary (hairline and nodes), never a funnel or a progress bar ——— */

const STEPS = OPPORTUNITY_STATUSES.filter((st) => st !== "closed");

const STAGE_PHRASE: Record<OpportunityStatus, string> = {
  identified: "You've found it",
  researching: "You're researching it",
  reaching_out: "You're reaching out",
  applied: "You've applied",
  interviewing: "You're interviewing",
  offer: "You have an offer",
  closed: "Closed",
};

export function StageTrack({ o, compact = false }: { o: Opportunity; compact?: boolean }) {
  const at = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const closed = o.status === "closed";
  const label = closed
    ? `Closed${o.closedReason ? ` · ${CLOSED_LABEL[o.closedReason]}` : ""}`
    : `${STAGE_LABEL[o.status]} · step ${at + 1} of ${STEPS.length}`;
  const phrase =
    closed && o.closedReason
      ? `Closed — ${CLOSED_LABEL[o.closedReason].toLowerCase()}`
      : STAGE_PHRASE[o.status];
  return (
    <div
      className={compact ? `${k.stages} ${k.compact}` : k.stages}
      data-closed={closed || undefined}
    >
      <p className={k.stageNow} aria-hidden="true">
        <span className={k.stageWord}>{phrase}</span>
        {!closed && (
          <span className={k.stageCount}>
            {at + 1} of {STEPS.length}
          </span>
        )}
      </p>
      <ol className={k.stageTrack} aria-label={`Stage: ${label}`}>
        {STEPS.map((st, i) => (
          <li
            key={st}
            className={k.stage}
            data-state={closed ? undefined : i < at ? "done" : i === at ? "current" : undefined}
            aria-current={!closed && i === at ? "step" : undefined}
          >
            <span className={k.stageNode} aria-hidden="true" />
            <span className={k.stageName}>{STAGE_LABEL[st]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ——— What has happened, across everyone involved ——— */

function DateMark({ date }: { date: CalendarDate }) {
  return (
    <span className={s.eventDate} aria-hidden="true">
      <span className={s.eventDay}>{Number(date.slice(8, 10))}</span>
      <span className={s.eventMonth}>{shortDay(date).split(" ")[2]}</span>
    </span>
  );
}

function eventHead(
  i: Interaction,
  first: string,
): { kind: string; title: string; icon: ReactNode } {
  switch (i.kind) {
    case "message_sent":
      return {
        kind: "sent",
        title: `You wrote to ${first}`,
        icon: <Icon.ArrowUpRight size={15} weight={2} />,
      };
    case "message_received":
      return {
        kind: "received",
        title: `${first} replied`,
        icon: <Icon.Chat size={15} weight={2} />,
      };
    case "meeting":
      return {
        kind: "meeting",
        title: `You met ${first}`,
        icon: <Icon.People size={15} weight={2} />,
      };
    case "note":
      return {
        kind: "note",
        title: `Your note about ${first}`,
        icon: <Icon.Note size={15} weight={2} />,
      };
  }
}

export function Activity({
  day,
  interactions,
  drafts,
  origin,
  empty,
  initial,
  dense = false,
}: {
  day: Day;
  interactions: Interaction[];
  drafts: Draft[];
  origin?: { date: CalendarDate; title: string; text?: string };
  empty: string;
  /** Show only the newest few, with a way to see the rest (phones). */
  initial?: number;
  /** Phones: set the history closer together. */
  dense?: boolean;
}) {
  const [all, setAll] = useState(false);
  const tz = day.user.timeZone;
  const sorted = interactions.toSorted((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  if (sorted.length === 0 && drafts.length === 0 && !origin) {
    return <p className={s.muted}>{empty}</p>;
  }
  const cap = initial === undefined || all ? Infinity : initial;
  const pending = drafts.slice(0, cap);
  const events = sorted.slice(0, Math.max(0, cap - pending.length));
  const hidden = drafts.length + sorted.length - pending.length - events.length;
  return (
    <>
      <ol className={s.timeline} data-dense={dense || undefined}>
        {pending.map((d) => {
          const person = day.index.person(d.personId);
          return (
            <li key={d.id} className={s.event} data-kind="draft">
              <span className={s.eventDate}>
                <span className={s.eventMonth}>Not sent</span>
              </span>
              <span className={s.node} data-kind="draft">
                <Icon.Pen size={15} weight={2} />
              </span>
              <div className={s.eventBody}>
                <p className={s.eventHead}>
                  Draft to {person ? firstName(person.name) : "them"}
                  <span className={s.eventMeta}>
                    {d.status === "approved" ? "approved, not sent" : "waiting for your approval"}
                  </span>
                </p>
                {d.subject && <p className={s.eventSubject}>“{d.subject}”</p>}
              </div>
            </li>
          );
        })}
        {events.map((i) => {
          const person = day.index.person(i.personId);
          const head = eventHead(i, person ? firstName(person.name) : "them");
          const date = dayOf(i.occurredAt, tz);
          const recent = delta(date, day.today) <= 2;
          const subject =
            (i.kind === "message_sent" || i.kind === "message_received") && i.subject
              ? i.subject
              : undefined;
          const meta = [
            i.kind === "note" ? undefined : channelOf(i),
            recent ? clock(i.occurredAt, tz) : undefined,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={i.id} className={s.event} data-kind={head.kind}>
              <DateMark date={date} />
              <span className={s.node} data-kind={head.kind}>
                {head.icon}
              </span>
              <div className={s.eventBody}>
                <p className={s.eventHead}>
                  {head.title}
                  {meta && <span className={s.eventMeta}>{meta}</span>}
                  <span className="sr-only">, {shortDay(date)}</span>
                </p>
                {subject && <p className={s.eventSubject}>“{subject}”</p>}
                <p className={s.eventText}>{i.summary}</p>
              </div>
            </li>
          );
        })}
        {origin && hidden === 0 && (
          <li className={s.event} data-kind="origin">
            <DateMark date={origin.date} />
            <span className={s.node} data-kind="origin">
              <Icon.Compass size={15} weight={2} />
            </span>
            <div className={s.eventBody}>
              <p className={s.eventHead}>
                {origin.title}
                <span className="sr-only">, {shortDay(origin.date)}</span>
              </p>
              {origin.text && <p className={s.eventText}>{origin.text}</p>}
            </div>
          </li>
        )}
      </ol>
      {hidden > 0 && (
        <button type="button" className={k.showAll} onClick={() => setAll(true)}>
          Show {hidden} earlier {hidden === 1 ? "moment" : "moments"}
          <Icon.ChevronDown size={15} weight={2} />
        </button>
      )}
    </>
  );
}

/* ——— What you know: numbered facts, each with where it came from ——— */

const PROVENANCE_ICON: Record<SourceFact["provenance"]["kind"], ReactNode> = {
  public_profile: <Icon.People size={13} weight={2} />,
  company_website: <Icon.Building size={13} weight={2} />,
  university_website: <Icon.Building size={13} weight={2} />,
  publication: <Icon.Note size={13} weight={2} />,
  event: <Icon.Calendar size={13} weight={2} />,
  correspondence: <Icon.Chat size={13} weight={2} />,
  other: <Icon.ArrowUpRight size={13} weight={2} />,
};

export function FactList({ facts, first = 1 }: { facts: SourceFact[]; first?: number }) {
  return (
    <ol className={s.facts}>
      {facts.map((f, i) => (
        <li key={f.id} className={s.fact}>
          <span className={s.badge} aria-label={`Fact ${first + i}`}>
            {first + i}
          </span>
          <span>
            {f.statement}
            <span className={s.source}>
              {PROVENANCE_ICON[f.provenance.kind]}
              {f.provenance.url ? (
                <a href={f.provenance.url} target="_blank" rel="noreferrer">
                  {PROVENANCE_LABEL[f.provenance.kind]}
                </a>
              ) : (
                PROVENANCE_LABEL[f.provenance.kind]
              )}
              {f.provenance.detail ? ` · ${f.provenance.detail}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ——— A planned step that isn't in Today yet ——— */

export function PlannedAction({
  action,
  day,
  announce,
}: {
  action: NextAction;
  day: Day;
  announce: Announce;
}) {
  const d = delta(day.today, action.dueOn);
  return (
    <div className={s.next}>
      <Tile date={action.dueOn} tone={d < 0 ? "late" : d === 0 ? "now" : undefined} />
      <span>
        <span className={s.nextTitle}>{action.title}</span>
        <span className={s.nextMeta}>
          {d === 0
            ? "Due today"
            : d === 1
              ? "Due tomorrow"
              : d < 0
                ? `${-d} days overdue`
                : `Due in ${d} days`}{" "}
          · {shortDay(action.dueOn)} · appears in Today nearer the time
        </span>
      </span>
      <button
        type="button"
        className={`${s.secondary} ${s.small}`}
        onClick={() => {
          day.complete(action.id);
          announce(`Done: ${action.title}.`);
        }}
      >
        <Icon.Check size={15} weight={2} /> Mark done
      </button>
    </div>
  );
}

/* ——— One thing to act on, as a phone card ——— */

/** Labels that fit two to a thumb-width row, as on Today. */
function thumbLabel(spec: ActionSpec): ActionSpec {
  if (spec.id === "snooze") return { ...spec, label: spec.label.split(" ").slice(0, 3).join(" ") };
  if (spec.id === "open") return { ...spec, label: "Open posting" };
  return spec;
}

/** The same verbs as Today's focus card: one primary action, then what else applies. */
export function MobileAction({
  ctx,
  day,
  announce,
  children,
  full = false,
  compact = false,
}: {
  ctx: ItemContext;
  day: Day;
  announce: Announce;
  children?: ReactNode;
  /** The item is the whole page: show the draft in full, under a top-level heading. */
  full?: boolean;
  /** One part of a longer page: a small tile, a shorter headline, a tighter composer. */
  compact?: boolean;
}) {
  const actions = useItemActions(ctx, day, announce);
  const Heading = full ? "h2" : "h3";
  const { draft } = ctx;

  if (compact) {
    return (
      <article className={`${k.mCard} ${k.mAction} ${k.cCard}`} aria-label={headline(ctx)}>
        <div className={k.cHead}>
          {tileFor(ctx, day, true)}
          <div className={s.rowText}>
            <Heading className={k.cHeadline}>{headline(ctx)}</Heading>
            <Status ctx={ctx} className={k.cStatus} />
          </div>
        </div>
        {children}
        {draft && actions.mode !== "edit" && (
          <div className={`${s.letter} ${s.mClamp} ${k.cLetter}`}>
            {draft.subject && <span className={s.letterSubject}>{draft.subject}</span>}
            {draft.body}
          </div>
        )}
        {actions.composer}
        <div className={k.cActions}>
          {actions.mode ? (
            <button type="button" className={s.secondary} onClick={actions.close}>
              Hide draft — keeps your text
            </button>
          ) : (
            actions.primary && <ActionButton spec={actions.primary} variant="primary" />
          )}
          {!actions.mode && actions.secondary.length > 0 && (
            <div className={k.cRow}>
              {actions.secondary.slice(0, 2).map((a) => (
                <ActionButton key={a.id} spec={thumbLabel(a)} variant="secondary" />
              ))}
            </div>
          )}
        </div>
      </article>
    );
  }
  return (
    <article className={`${k.mCard} ${k.mAction}`} aria-label={headline(ctx)}>
      <div className={s.mHead}>
        {tileFor(ctx, day)}
        <div>
          <Heading className={s.mHeadline}>{headline(ctx)}</Heading>
          <Status ctx={ctx} className={s.mStatus} />
        </div>
      </div>
      {children}
      {draft && actions.mode !== "edit" && (
        <div className={full ? s.letter : `${s.letter} ${s.mClamp}`}>
          {draft.subject && <span className={s.letterSubject}>{draft.subject}</span>}
          {draft.body}
        </div>
      )}
      {actions.composer}
      <div className={s.mActions}>
        {actions.mode ? (
          <button type="button" className={s.secondary} onClick={actions.close}>
            Hide draft — keeps your text
          </button>
        ) : (
          actions.primary && <ActionButton spec={actions.primary} variant="primary" />
        )}
        {!actions.mode && actions.secondary.length > 0 && (
          <div className={s.mRow}>
            {actions.secondary.slice(0, 2).map((a) => (
              <ActionButton key={a.id} spec={thumbLabel(a)} variant="secondary" />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/* ——— People involved, as they read on People ——— */

export function PersonLine({
  person,
  day,
  onOpen,
  context,
}: {
  person: Person;
  day: Day;
  onOpen: () => void;
  /** e.g. their company, when it isn't obvious from where the list sits. */
  context?: string;
}) {
  return (
    <div className={k.personLine}>
      <Avatar name={person.name} size={40} />
      <div className={k.personLineText}>
        <button type="button" className={k.personLineName} onClick={onOpen}>
          {person.name}
        </button>
        <span className={k.personLineRole}>
          {[person.role, context].filter(Boolean).join(" · ")}
        </span>
        <Standing person={person} day={day} />
        {person.whyRelevant && <p className={k.personLineWhy}>{person.whyRelevant}</p>}
      </div>
    </div>
  );
}

/** A company's mark: its initial on a quiet tile. Avatars stay for people. */
export function Mark({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span className={k.mark} style={{ "--size": `${size}px` } as CSSProperties} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
