"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/avatar";
import { ago, clock, dayOf, delta, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { Interaction } from "@/domain/interaction";
import type { Person } from "@/domain/person";
import type { CalendarDate } from "@/domain/time";
import type { ItemContext } from "@/features/workspace/records";
import {
  channelOf,
  firstName,
  OUTREACH_LABEL,
  RELATIONSHIP_LABEL,
  sourceText,
} from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import s from "./today.module.css";
import type { Tone } from "./wording";
import { lastExchange, statusFor } from "./wording";

/** Status in words with its colour: never colour alone. */
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
 * the relationship, and when you last spoke. Never a row of chips.
 */
export function Standing({
  person,
  day,
  withLastContact = true,
}: {
  person: Person;
  day: WorkspaceState;
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

/* ——— Between you: the relationship story, newest first, ending where it began ——— */

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
      return { kind: "sent", title: "You wrote", icon: <Icon.ArrowUpRight size={15} weight={2} /> };
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
      return { kind: "note", title: "Your note", icon: <Icon.Note size={15} weight={2} /> };
  }
}

function History({ person, day }: { person: Person; day: WorkspaceState }) {
  const first = firstName(person.name);
  const tz = day.user.timeZone;
  const history = day.index.historyOf(person.id).toReversed();
  const drafts = day.index.pendingDraftsFor(person.id);
  // Where it began: when you added them, or your first exchange if that came earlier.
  const added = dayOf(person.createdAt, tz);
  const earliest = history.at(-1);
  const firstContact = earliest ? dayOf(earliest.occurredAt, tz) : added;
  const found = firstContact < added ? firstContact : added;

  return (
    <ol className={s.timeline}>
      {drafts.map((d) => (
        <li key={d.id} className={s.event} data-kind="draft">
          <span className={s.eventDate}>
            <span className={s.eventMonth}>Not sent</span>
          </span>
          <span className={s.node} data-kind="draft">
            <Icon.Pen size={15} weight={2} />
          </span>
          <div className={s.eventBody}>
            <p className={s.eventHead}>
              Draft {d.channel === "email" ? "email" : "message"}
              <span className={s.eventMeta}>
                {d.status === "approved" ? "approved, not sent" : "waiting for your approval"}
              </span>
            </p>
            <div className={s.draftBox}>{d.body}</div>
          </div>
        </li>
      ))}
      {history.map((i) => {
        const head = eventHead(i, first);
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
      <li className={s.event} data-kind="origin">
        <DateMark date={found} />
        <span className={s.node} data-kind="origin">
          <Icon.Compass size={15} weight={2} />
        </span>
        <div className={s.eventBody}>
          <p className={s.eventHead}>
            You found {first}
            <span className="sr-only">, {shortDay(found)}</span>
          </p>
          <p className={s.eventText}>{sourceText(person)}</p>
        </div>
      </li>
    </ol>
  );
}

/**
 * On a phone, the person behind the current item opens in a sheet over Today,
 * so you keep your place. Escape or Close dismisses it and returns focus.
 */
export function PersonSheet({
  person,
  day,
  onClose,
}: {
  person: Person;
  day: WorkspaceState;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const company = day.index.companyOf(person);
  const first = firstName(person.name);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <>
      <div className={s.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={s.mSheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="m-sheet-name"
        tabIndex={-1}
      >
        <div className={s.grabber} aria-hidden="true" />
        <div className={`${s.sheetBody} ${s.scroll}`}>
          <div className={s.sheetHead}>
            <Avatar name={person.name} size={52} />
            <div className={s.rowText}>
              <h2 id="m-sheet-name" className={s.sheetName}>
                {person.name}
              </h2>
              <span className={s.pRole}>
                {[person.role, company?.name].filter(Boolean).join(" · ")}
              </span>
            </div>
            <ContactActions person={person} />
          </div>
          <Standing person={person} day={day} />
          {person.whyRelevant && (
            <section className={s.why} aria-labelledby="m-sheet-why">
              <h3 id="m-sheet-why" className={s.whyLabel}>
                <Icon.Compass size={14} weight={2} />
                Why {first} matters
              </h3>
              <p className={s.whyText}>{person.whyRelevant}</p>
            </section>
          )}
          <h3 className={s.h3}>Between you</h3>
          <History person={person} day={day} />
        </div>
        <div className={s.sheetFoot}>
          <button type="button" className={s.secondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
