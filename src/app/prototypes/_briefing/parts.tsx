"use client";

import { useEffect, useRef, useState } from "react";
import type { Interaction } from "@/domain/interaction";
import type { OpportunityId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import { ago, dayCount, longDay, shortDay, weekday } from "../_shared/dates";
import type { SurfaceId } from "../_shared/options";
import type { ItemContext } from "../_shared/snapshot";
import {
  capitalise,
  channelNoun,
  countWord,
  firstName,
  initials,
  listOf,
  RELATIONSHIP_LABEL,
  sentVerb,
  STAGE_LABEL,
} from "../_shared/snapshot";
import type { Day } from "../_shared/use-day";
import s from "./briefing.module.css";

/* ——— Masthead ——— */

const NAV: { label: string; surface?: SurfaceId }[] = [
  { label: "Today", surface: "today" },
  { label: "People", surface: "people" },
  { label: "Opportunities" },
  { label: "Outreach" },
  { label: "Companies" },
];

export function Masthead({
  active,
  day,
  navigate,
}: {
  active: SurfaceId;
  day: Day;
  navigate: (surface: SurfaceId) => void;
}) {
  return (
    <header className={s.masthead}>
      <span className={s.wordmark}>Reachout</span>
      <nav className={s.nav} aria-label="Sections">
        {NAV.map((item) =>
          item.surface ? (
            <button
              key={item.label}
              type="button"
              className={s.navItem}
              aria-current={item.surface === active ? "page" : undefined}
              onClick={() => item.surface && navigate(item.surface)}
            >
              {item.label}
            </button>
          ) : (
            <span
              key={item.label}
              className={s.navItem}
              aria-disabled="true"
              title="Not part of this exploration"
            >
              {item.label}
            </span>
          ),
        )}
      </nav>
      <div className={s.mastMeta}>
        <span>{longDay(day.today)}</span>
        <span className={s.monogram} aria-label={day.user.name}>
          {initials(day.user.name)}
        </span>
      </div>
    </header>
  );
}

/* ——— Sentences ——— */

export type EntryCopy = {
  margin: string;
  late: boolean;
  lead: string;
  rest: string;
  quote?: string;
  meta?: string;
};

function personLine(ctx: ItemContext): string | undefined {
  const role = [ctx.person?.role, ctx.company?.name].filter(Boolean).join(", ");
  return [role, ctx.opportunity?.title].filter(Boolean).join(" · ") || undefined;
}

/** Writes an attention item as a sentence. Wording only; the item itself comes from deriveToday. */
export function entryCopy(ctx: ItemContext, day: Day): EntryCopy {
  const { item, person, company, opportunity, action, draft, message } = ctx;
  const name = person?.name ?? "them";
  const first = person ? firstName(person.name) : "them";
  const meta = personLine(ctx);

  switch (item.kind) {
    case "overdue_follow_up": {
      const since = message ? day.index.daysSince(message.occurredAt) : undefined;
      return {
        margin: `${dayCount(item.daysOverdue)} late`,
        late: true,
        lead: action?.title ?? `Follow up with ${name}`,
        rest:
          since === undefined
            ? "."
            : ` — you ${sentVerb(message)} ${first} ${ago(since)} and haven't heard back.`,
        meta,
      };
    }
    case "reply_awaiting_response": {
      const waited = -ctx.days;
      const via =
        message && "channel" in message && message.channel === "linkedin" ? " on LinkedIn" : "";
      return {
        margin: waited === 0 ? "Replied today" : `Waiting ${dayCount(waited)}`,
        late: waited >= 2,
        lead: `${name} replied`,
        rest: `${via} ${ago(waited)}.`,
        quote: message?.summary,
        meta,
      };
    }
    case "deadline_approaching": {
      const names = opportunity
        ? day.index.peopleOf(opportunity).map((p) => firstName(p.name))
        : [];
      const when =
        item.daysRemaining === 0
          ? "today"
          : item.daysRemaining === 1
            ? "tomorrow"
            : `on ${weekday(item.deadline)}`;
      return {
        margin:
          item.daysRemaining === 0
            ? "Closes today"
            : `Closes ${shortDay(item.deadline).split(" ")[0]}`,
        late: item.daysRemaining <= 1,
        lead: opportunity?.title ?? "An opportunity",
        rest: `${company ? ` at ${company.name}` : ""} closes ${when}${
          names.length ? `. You know ${listOf(names)} there.` : "."
        }`,
        meta: opportunity
          ? `${STAGE_LABEL[opportunity.status]} · deadline ${longDay(item.deadline)}`
          : undefined,
      };
    }
    case "draft_awaiting_approval":
      return {
        margin: "To approve",
        late: false,
        lead: `Your ${draft ? channelNoun(draft.channel) : "message"} to ${name}`,
        rest: " is written and waiting for your approval.",
        quote: draft?.subject,
        meta,
      };
    case "draft_ready_to_send": {
      const where =
        draft?.channel === "linkedin"
          ? "LinkedIn"
          : draft?.channel === "email"
            ? "your inbox"
            : `wherever you message ${first}`;
      return {
        margin: "Approved",
        late: false,
        lead: `Your ${draft ? channelNoun(draft.channel) : "message"} to ${name}`,
        rest: ` is approved. Send it from ${where}, then mark it as sent.`,
        meta,
      };
    }
    case "upcoming_action": {
      const d = item.daysUntilDue;
      return {
        margin:
          d < 0
            ? `${dayCount(d)} late`
            : d === 0
              ? "Today"
              : d === 1
                ? "Tomorrow"
                : shortDay(item.dueOn),
        late: d < 0,
        lead: action?.title ?? "Next step",
        rest: ".",
        meta,
      };
    }
  }
}

/** The opening paragraph: what the day holds, in one sentence. */
export function lede(contexts: ItemContext[]): string {
  const of = (kind: ItemContext["item"]["kind"]) => contexts.filter((c) => c.item.kind === kind);
  const parts: string[] = [];
  const late = of("overdue_follow_up").length;
  if (late)
    parts.push(late === 1 ? "one follow-up is late" : `${countWord(late)} follow-ups are late`);
  const replies = of("reply_awaiting_response");
  const onlyReply = replies[0]?.person;
  if (replies.length === 1 && onlyReply)
    parts.push(`${firstName(onlyReply.name)} is waiting on your reply`);
  else if (replies.length > 1)
    parts.push(`${countWord(replies.length)} people are waiting on replies`);
  const deadlines = of("deadline_approaching");
  const onlyDeadline = deadlines[0];
  if (deadlines.length === 1 && onlyDeadline?.item.kind === "deadline_approaching") {
    const n = onlyDeadline.item.daysRemaining;
    const owner = onlyDeadline.company?.name ?? "one";
    parts.push(
      `${owner}'s deadline is ${n === 0 ? "today" : n === 1 ? "tomorrow" : weekday(onlyDeadline.item.deadline)}`,
    );
  } else if (deadlines.length > 1)
    parts.push(`${countWord(deadlines.length)} deadlines close this week`);
  const drafts = of("draft_awaiting_approval").length + of("draft_ready_to_send").length;
  if (drafts)
    parts.push(`${countWord(drafts)} ${drafts === 1 ? "draft needs" : "drafts need"} you`);
  if (parts.length === 0) {
    const upcoming = of("upcoming_action").length;
    return upcoming
      ? `Nothing is pressing. ${capitalise(countWord(upcoming))} ${upcoming === 1 ? "thing is" : "things are"} coming up.`
      : "Nothing needs you today.";
  }
  return `${capitalise(listOf(parts))}.`;
}

/* ——— Actions ——— */

export type ActionId =
  "compose" | "people" | "read" | "approve" | "copy" | "sent" | "done" | "snooze";
export type ActionSpec = { id: ActionId; label: string; primary?: boolean };

export function actionsFor(ctx: ItemContext, day: Day): ActionSpec[] {
  const { item, person, action } = ctx;
  const first = person ? firstName(person.name) : "";
  const snooze: ActionSpec[] =
    action?.status === "open"
      ? [{ id: "snooze", label: `Snooze to ${shortDay(day.snoozeTarget(action))}` }]
      : [];
  switch (item.kind) {
    case "overdue_follow_up":
      return [
        { id: "compose", label: "Write the follow-up", primary: true },
        ...snooze,
        { id: "done", label: "Already done" },
      ];
    case "reply_awaiting_response":
      return [{ id: "compose", label: `Reply to ${first}`, primary: true }];
    case "deadline_approaching":
      return [{ id: "people", label: "Who you know there", primary: true }];
    case "draft_awaiting_approval":
      return [{ id: "read", label: "Read and approve", primary: true }];
    case "draft_ready_to_send":
      return [
        { id: "sent", label: "Mark as sent", primary: true },
        { id: "read", label: "Show message" },
        { id: "copy", label: "Copy text" },
      ];
    case "upcoming_action":
      return [{ id: "done", label: "Mark done", primary: true }, ...snooze];
  }
}

/* ——— Composer ——— */

function replySubject(message: Interaction | undefined): string {
  if (
    message &&
    (message.kind === "message_sent" || message.kind === "message_received") &&
    message.subject
  ) {
    return message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`;
  }
  return "";
}

/** A sheet of paper, not a form. Saving creates a draft that still needs approval. */
export function Composer({
  person,
  opportunityId,
  message,
  day,
  onSaved,
  onCancel,
}: {
  person: Person;
  opportunityId?: OpportunityId;
  message?: Interaction;
  day: Day;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const channel =
    message && (message.kind === "message_sent" || message.kind === "message_received")
      ? message.channel
      : (person.preferredChannel ?? (person.email ? "email" : "linkedin"));
  const [subject, setSubject] = useState(replySubject(message));
  const [body, setBody] = useState("");
  const letter = useRef<HTMLTextAreaElement>(null);
  const first = firstName(person.name);
  const ready = body.trim() !== "" && (channel !== "email" || subject.trim() !== "");

  useEffect(() => {
    letter.current?.focus();
  }, []);

  return (
    <div className={s.composer}>
      <div className={s.composerHead}>
        <span>To {person.name}</span>
        <span>{capitalise(channelNoun(channel))}</span>
      </div>
      {channel === "email" && (
        <input
          className={s.subjectInput}
          aria-label="Subject"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      )}
      <textarea
        ref={letter}
        className={s.letter}
        aria-label={`Message to ${person.name}`}
        placeholder={`Write to ${first} the way you'd say it.`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className={s.composerFoot}>
        <button
          type="button"
          className={s.button}
          disabled={!ready}
          onClick={() => {
            day.saveDraft({ personId: person.id, opportunityId, channel, subject, body });
            onSaved();
          }}
        >
          Save as draft
        </button>
        <button type="button" className={s.ghost} onClick={onCancel}>
          Cancel
        </button>
        <span>Nothing is sent until you approve it.</span>
      </div>
    </div>
  );
}

/* ——— An attention item, written out ——— */

export function useEntry(ctx: ItemContext, day: Day) {
  const [panel, setPanel] = useState<null | "compose" | "people" | "read">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { person, action, draft } = ctx;

  const run = (id: ActionId) => {
    setNotice(null);
    switch (id) {
      case "compose":
      case "people":
      case "read":
        setPanel((p) => (p === id ? null : id));
        return;
      case "approve":
        if (draft) day.approve(draft.id);
        return;
      case "copy":
        if (draft) void navigator.clipboard?.writeText(draft.body);
        setNotice("Copied. Paste it into your message, then mark it as sent.");
        return;
      case "sent":
        if (draft) day.markSent(draft.id);
        return;
      case "done":
        if (action) day.complete(action.id);
        return;
      case "snooze":
        if (action) day.snooze(action.id);
        return;
    }
  };

  const panelView =
    panel === "compose" && person ? (
      <Composer
        person={person}
        opportunityId={ctx.opportunity?.id}
        message={ctx.message}
        day={day}
        onCancel={() => setPanel(null)}
        onSaved={() => {
          setPanel(null);
          setNotice("Saved as a draft. It's waiting for your approval under Drafts.");
        }}
      />
    ) : panel === "people" && ctx.opportunity ? (
      <ul className={s.peopleThere}>
        {day.index.peopleOf(ctx.opportunity).map((p) => (
          <li key={p.id}>
            <b>{p.name}</b> — {p.role ?? "No role recorded"} ·{" "}
            {RELATIONSHIP_LABEL[p.relationshipStatus].toLowerCase()}
          </li>
        ))}
      </ul>
    ) : panel === "read" && draft ? (
      <div className={s.message}>
        {draft.subject && <span className={s.messageSubject}>Subject: {draft.subject}</span>}
        {draft.body}
        {draft.status === "awaiting_approval" && (
          <div className={s.actions}>
            <button type="button" className={s.button} onClick={() => run("approve")}>
              Approve
            </button>
            <span className={s.meta}>
              Approving doesn&apos;t send it — you still send it yourself.
            </span>
          </div>
        )}
      </div>
    ) : null;

  return { run, panelView, notice };
}
