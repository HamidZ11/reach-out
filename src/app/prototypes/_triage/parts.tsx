"use client";

import type { ReactNode, Ref } from "react";
import { useState } from "react";
import type { Draft } from "@/domain/draft";
import type { Interaction } from "@/domain/interaction";
import type { Person } from "@/domain/person";
import { clock, dayMonth, dayOf, shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { SurfaceId } from "../_shared/options";
import type { ItemContext } from "../_shared/snapshot";
import {
  capitalise,
  channelNoun,
  channelOf,
  firstName,
  initials,
  OUTREACH_LABEL,
  PROVENANCE_LABEL,
  RELATIONSHIP_LABEL,
  sourceText,
  STAGE_LABEL,
} from "../_shared/snapshot";
import type { Day } from "../_shared/use-day";
import s from "./triage.module.css";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className={s.avatar} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/* ——— Rail ——— */

export function Rail({
  active,
  day,
  navigate,
}: {
  active: SurfaceId;
  day: Day;
  navigate: (surface: SurfaceId) => void;
}) {
  const rows: { label: string; icon: ReactNode; count: number; surface?: SurfaceId }[] = [
    { label: "Today", icon: <Icon.Sun />, count: day.items.length, surface: "today" },
    { label: "People", icon: <Icon.People />, count: day.records.people.length, surface: "people" },
    {
      label: "Opportunities",
      icon: <Icon.Target />,
      count: day.records.opportunities.filter((o) => o.status !== "closed").length,
    },
    {
      label: "Outreach",
      icon: <Icon.Inbox />,
      count: day.records.drafts.filter(
        (d) => d.status === "awaiting_approval" || d.status === "approved",
      ).length,
    },
    { label: "Companies", icon: <Icon.Building />, count: day.records.companies.length },
  ];
  return (
    <nav className={s.rail} aria-label="Sections">
      <div className={s.brand}>
        <span className={s.brandMark} aria-hidden="true" />
        reachout
      </div>
      {rows.map((row) =>
        row.surface ? (
          <button
            key={row.label}
            type="button"
            className={s.navRow}
            aria-current={row.surface === active ? "page" : undefined}
            onClick={() => row.surface && navigate(row.surface)}
          >
            {row.icon}
            <span>{row.label}</span>
            <span className={s.navCount}>{row.count}</span>
          </button>
        ) : (
          <span
            key={row.label}
            className={s.navRow}
            aria-disabled="true"
            title="Not part of this exploration"
          >
            {row.icon}
            <span>{row.label}</span>
            <span className={s.navCount}>{row.count}</span>
          </span>
        ),
      )}
      <div className={s.railFoot}>
        <Avatar name={day.user.name} />
        <span>{day.user.name}</span>
      </div>
    </nav>
  );
}

/* ——— Row wording ——— */

export type Tone = "late" | "now" | undefined;

/** Signed days in mono: −2d, today, +3d. Undated drafts read "ready". */
export function gutter(ctx: ItemContext): { text: string; tone: Tone } {
  const { item } = ctx;
  if (item.kind === "draft_awaiting_approval" || item.kind === "draft_ready_to_send") {
    return { text: "ready", tone: "now" };
  }
  const d = ctx.days;
  const text = d === 0 ? "today" : d > 0 ? `+${d}d` : `−${-d}d`;
  if (item.kind === "overdue_follow_up" || (item.kind === "upcoming_action" && d < 0)) {
    return { text, tone: "late" };
  }
  if (item.kind === "reply_awaiting_response" || d === 0) return { text, tone: "now" };
  return { text, tone: undefined };
}

export function kindIcon(ctx: ItemContext): ReactNode {
  switch (ctx.item.kind) {
    case "overdue_follow_up":
      return <Icon.Clock size={15} />;
    case "reply_awaiting_response":
      return <Icon.Chat size={15} />;
    case "deadline_approaching":
      return <Icon.Calendar size={15} />;
    case "draft_awaiting_approval":
      return <Icon.Pen size={15} />;
    case "draft_ready_to_send":
      return <Icon.Send size={15} />;
    case "upcoming_action":
      return <Icon.Check size={15} />;
  }
}

export const GROUPS: { tier: number; label: string }[] = [
  { tier: 1, label: "Overdue" },
  { tier: 2, label: "Waiting on you" },
  { tier: 3, label: "Deadlines" },
  { tier: 4, label: "To approve and send" },
  { tier: 5, label: "Upcoming" },
];

export function rowCopy(ctx: ItemContext, day: Day): { title: string; sub: string } {
  const { item, person, company, opportunity, action, draft, message } = ctx;
  const name = person?.name ?? "";
  const at = [name, company?.name].filter(Boolean).join(" · ");
  switch (item.kind) {
    case "overdue_follow_up": {
      const since = message ? day.index.daysSince(message.occurredAt) : undefined;
      const via = channelOf(message)?.toLowerCase() ?? "message";
      return {
        title: action?.title ?? `Follow up with ${name}`,
        sub: since === undefined ? at : `${at} · ${via} sent ${since}d ago, no reply`,
      };
    }
    case "reply_awaiting_response":
      return {
        title: `Reply to ${name}`,
        sub: `${company?.name ?? ""}${company ? " · " : ""}${message?.summary ?? ""}`,
      };
    case "deadline_approaching":
      return {
        title: `${opportunity?.title ?? "Opportunity"} closes`,
        sub: [
          company?.name,
          opportunity ? STAGE_LABEL[opportunity.status] : undefined,
          opportunity ? `${opportunity.personIds.length} people` : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "draft_awaiting_approval":
      return {
        title: `Approve ${draft ? channelNoun(draft.channel) : "message"} to ${name}`,
        sub: draft?.subject ?? draft?.body.split("\n")[0] ?? "",
      };
    case "draft_ready_to_send":
      return {
        title: `Send ${draft ? channelNoun(draft.channel) : "message"} to ${name}`,
        sub: `Approved · ${draft?.subject ?? draft?.body.slice(0, 80) ?? ""}`,
      };
    case "upcoming_action":
      return {
        title: action?.title ?? "Next step",
        sub: [person?.name, opportunity?.title].filter(Boolean).join(" · "),
      };
  }
}

/* ——— Thread ——— */

export function Thread({ person, day }: { person: Person; day: Day }) {
  const history = day.index.historyOf(person.id);
  const drafts = day.index.pendingDraftsFor(person.id);
  const first = firstName(person.name);
  if (history.length === 0 && drafts.length === 0) {
    return <p className={s.muted}>No contact with {first} yet.</p>;
  }
  const who = (i: Interaction) =>
    i.kind === "note"
      ? "Note"
      : i.kind === "meeting"
        ? `Met · ${channelOf(i)}`
        : i.kind === "message_received"
          ? `${first} · ${channelOf(i)}`
          : `You · ${channelOf(i)}`;
  return (
    <ol className={s.thread}>
      {history.map((i) => (
        <li
          key={i.id}
          className={s.turn}
          data-them={i.kind === "message_received" || undefined}
          data-note={i.kind === "note" || undefined}
        >
          <span className={s.turnWhen}>
            {dayMonth(dayOf(i.occurredAt, day.user.timeZone))}{" "}
            {clock(i.occurredAt, day.user.timeZone)}
          </span>
          <span>
            <span className={s.turnWho}>
              {i.kind === "message_received" ? "←" : i.kind === "message_sent" ? "→" : "·"} {who(i)}
            </span>
            <p className={s.turnText}>{i.summary}</p>
          </span>
        </li>
      ))}
      {drafts.map((d) => (
        <li key={d.id} className={s.turn} data-draft="">
          <span className={s.turnWhen}>draft</span>
          <span>
            <span className={s.turnWho}>
              → You · {capitalise(channelNoun(d.channel))} ·{" "}
              {d.status === "approved" ? "approved, not sent" : "awaiting approval"}
            </span>
            <p className={s.turnText}>{d.body}</p>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ——— Composer ——— */

export function Composer({
  person,
  ctx,
  day,
  onSaved,
  ref,
}: {
  person: Person;
  ctx?: ItemContext;
  day: Day;
  onSaved: (message: string) => void;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  const message = ctx?.message;
  const channel =
    message && (message.kind === "message_sent" || message.kind === "message_received")
      ? message.channel
      : (person.preferredChannel ?? (person.email ? "email" : "linkedin"));
  const original =
    message && (message.kind === "message_sent" || message.kind === "message_received")
      ? message.subject
      : undefined;
  const [subject, setSubject] = useState(original ? `Re: ${original.replace(/^Re:\s*/, "")}` : "");
  const [body, setBody] = useState("");
  const ready = body.trim() !== "" && (channel !== "email" || subject.trim() !== "");
  const save = () => {
    if (!ready) return;
    day.saveDraft({
      personId: person.id,
      opportunityId: ctx?.opportunity?.id,
      channel,
      subject,
      body,
    });
    setBody("");
    onSaved(`Draft to ${firstName(person.name)} saved — it's in the queue for approval.`);
  };
  return (
    <div className={s.composer}>
      <div className={s.composerHead}>
        <span>
          Draft to {person.name} · {channelNoun(channel)}
        </span>
        <span>
          <Kbd>↵</Kbd> to focus
        </span>
      </div>
      {channel === "email" && (
        <input
          className={s.field}
          aria-label="Subject"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      )}
      <textarea
        ref={ref}
        className={s.field}
        aria-label={`Draft to ${person.name}`}
        placeholder={`Write to ${firstName(person.name)}…`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          if (e.key === "Escape") e.currentTarget.blur();
        }}
      />
      <div className={s.composerFoot}>
        <button type="button" className={s.button} data-primary="" disabled={!ready} onClick={save}>
          Save draft <Kbd>⌘↵</Kbd>
        </button>
        <span>Drafts wait for approval. Nothing sends from here.</span>
      </div>
    </div>
  );
}

/* ——— Person context ——— */

export function PersonHeader({ person, day }: { person: Person; day: Day }) {
  const company = day.index.companyOf(person);
  const state = day.outreachOf(person.id);
  const tone: Tone | "ok" =
    state === "replied"
      ? "ok"
      : state === "follow_up_due"
        ? "late"
        : state === "draft"
          ? "now"
          : undefined;
  return (
    <>
      <div className={s.identity}>
        <Avatar name={person.name} />
        <div>
          <h2 className={s.personName}>{person.name}</h2>
          <div className={s.personRole}>
            {[person.role, company?.name, person.location].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      <div className={s.states}>
        <span className={s.state}>
          <span className={s.dot} data-tone={tone} aria-hidden="true" />
          {OUTREACH_LABEL[state]}
        </span>
        <span className={s.state}>{RELATIONSHIP_LABEL[person.relationshipStatus]}</span>
        <span className={s.state}>{sourceText(person)}</span>
      </div>
    </>
  );
}

export function Research({ person, day }: { person: Person; day: Day }) {
  const company = day.index.companyOf(person);
  const facts = [
    ...day.index.factsAbout({ type: "person", id: person.id }),
    ...(company ? day.index.factsAbout({ type: "company", id: company.id }) : []),
  ];
  const ref = new Map<string, number>(facts.map((f, i) => [f.id, i + 1]));
  const readings = day.index.interpretationsAbout({ type: "person", id: person.id });
  return (
    <>
      <section className={s.section}>
        <h3 className={s.label}>
          <span>Facts</span>
          <span className={s.mono}>{facts.length}</span>
        </h3>
        {facts.length === 0 ? (
          <p className={s.muted}>Nothing recorded yet.</p>
        ) : (
          <ol className={s.facts}>
            {facts.map((f) => (
              <li key={f.id} className={s.fact}>
                <span className={s.factRef}>[{ref.get(f.id)}]</span>
                <span>
                  {f.statement}
                  <span className={s.source}>
                    {f.subject.type === "company" ? `${company?.name} · ` : ""}
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
        )}
      </section>
      {readings.length > 0 && (
        <section className={s.section}>
          <h3 className={s.label}>Interpretation</h3>
          {readings.map((r) => (
            <p key={r.id} className={s.reading}>
              <span className={s.readingTag}>
                Generated · cites {r.basedOnFactIds.map((id) => `[${ref.get(id) ?? "?"}]`).join("")}{" "}
                · {r.review === "accepted" ? "kept" : r.review}
              </span>
              {r.text}
            </p>
          ))}
        </section>
      )}
      <section className={s.section}>
        <h3 className={s.label}>Your notes</h3>
        {person.notes ? (
          <p className={s.why}>{person.notes}</p>
        ) : (
          <p className={s.muted}>No notes.</p>
        )}
      </section>
    </>
  );
}

export function DraftActions({
  draft,
  day,
  onDone,
}: {
  draft: Draft;
  day: Day;
  onDone: (m: string) => void;
}) {
  if (draft.status === "awaiting_approval") {
    return (
      <div className={s.buttons}>
        <button
          type="button"
          className={s.button}
          data-primary=""
          onClick={() => day.approve(draft.id)}
        >
          Approve <Kbd>A</Kbd>
        </button>
      </div>
    );
  }
  if (draft.status !== "approved") return null;
  return (
    <div className={s.buttons}>
      <button
        type="button"
        className={s.button}
        data-primary=""
        onClick={() => {
          day.markSent(draft.id);
          onDone("Marked as sent and added to the thread.");
        }}
      >
        Mark as sent <Kbd>M</Kbd>
      </button>
      <button
        type="button"
        className={s.button}
        onClick={() => {
          void navigator.clipboard?.writeText(draft.body);
          onDone("Copied to the clipboard.");
        }}
      >
        <Icon.Copy size={14} /> Copy text
      </button>
    </div>
  );
}

export function snoozeLabel(ctx: ItemContext, day: Day): string | undefined {
  return ctx.action?.status === "open" ? shortDay(day.snoozeTarget(ctx.action)) : undefined;
}
