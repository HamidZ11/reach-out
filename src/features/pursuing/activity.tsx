"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { clock, dayOf, delta, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { Draft } from "@/domain/draft";
import type { Interaction } from "@/domain/interaction";
import type { CalendarDate } from "@/domain/time";
import { compareInstants } from "@/domain/time";
import pp from "@/features/people/people.module.css";
import { DateMark } from "@/features/today/person";
import t from "@/features/today/today.module.css";
import { channelOf, firstName } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import k from "./pursuing.module.css";

/**
 * What has happened on an opportunity, across everyone involved: the same
 * light timeline as a person's history, newest first, ending where it began.
 * Not a feed — each moment names who it was with.
 */

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
  day: WorkspaceState;
  interactions: Interaction[];
  drafts: Draft[];
  origin?: { date: CalendarDate; title: string; text?: string };
  empty: string;
  /** Phones: show only the newest few, with a way to see the rest. */
  initial?: number;
  /** Phones: set the history closer together. */
  dense?: boolean;
}) {
  const [all, setAll] = useState(false);
  const tz = day.user.timeZone;
  const sorted = interactions.toSorted((a, b) => compareInstants(b.occurredAt, a.occurredAt));
  if (sorted.length === 0 && drafts.length === 0 && !origin) {
    return <p className={pp.muted}>{empty}</p>;
  }
  const cap = initial === undefined || all ? Infinity : initial;
  const pending = drafts.slice(0, cap);
  const events = sorted.slice(0, Math.max(0, cap - pending.length));
  const hidden = drafts.length + sorted.length - pending.length - events.length;
  const nameOf = (personId: Interaction["personId"]) => {
    const person = day.index.person(personId);
    return person ? firstName(person.name) : "them";
  };

  return (
    <>
      <ol className={t.timeline} data-dense={dense || undefined}>
        {pending.map((d) => (
          <li key={d.id} className={t.event} data-kind="draft">
            <span className={t.eventDate}>
              <span className={t.eventMonth}>Not sent</span>
            </span>
            <span className={t.node} data-kind="draft">
              <Icon.Pen size={15} weight={2} />
            </span>
            <div className={t.eventBody}>
              <p className={t.eventHead}>
                Draft to {nameOf(d.personId)}
                <span className={t.eventMeta}>
                  {d.status === "approved" ? "approved, not sent" : "waiting for your approval"}
                </span>
              </p>
              {d.subject && <p className={t.eventSubject}>“{d.subject}”</p>}
            </div>
          </li>
        ))}
        {events.map((i) => {
          const head = eventHead(i, nameOf(i.personId));
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
            <li key={i.id} className={t.event} data-kind={head.kind}>
              <DateMark date={date} />
              <span className={t.node} data-kind={head.kind}>
                {head.icon}
              </span>
              <div className={t.eventBody}>
                <p className={t.eventHead}>
                  {head.title}
                  {meta && <span className={t.eventMeta}>{meta}</span>}
                  <span className="sr-only">, {shortDay(date)}</span>
                </p>
                {subject && <p className={t.eventSubject}>“{subject}”</p>}
                <p className={t.eventText}>{i.summary}</p>
              </div>
            </li>
          );
        })}
        {origin && hidden === 0 && (
          <li className={t.event} data-kind="origin">
            <DateMark date={origin.date} />
            <span className={t.node} data-kind="origin">
              <Icon.Compass size={15} weight={2} />
            </span>
            <div className={t.eventBody}>
              <p className={t.eventHead}>
                {origin.title}
                <span className="sr-only">, {shortDay(origin.date)}</span>
              </p>
              {origin.text && <p className={t.eventText}>{origin.text}</p>}
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
