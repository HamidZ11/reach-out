"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import type { PersonId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import type { Opportunity } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import type { SourceFact } from "@/domain/research";
import type { CalendarDate } from "@/domain/time";
import { clock, dayOf, delta, shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { ItemContext } from "../_shared/snapshot";
import {
  channelOf,
  deadlineText,
  firstName,
  PROVENANCE_LABEL,
  sourceText,
  STAGE_LABEL,
} from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import type { Announce } from "./actions";
import { ActionButton, useAnnouncer, useItemActions } from "./actions";
import s from "./focus.module.css";
import {
  AppFrame,
  Avatar,
  ContactActions,
  headline,
  personHandoff,
  personState,
  Standing,
  Status,
  Tile,
  tileFor,
} from "./parts";

export type Group = { key: string; title: string; meta?: string; people: Person[] };

/** People arranged by what they can help with: upcoming deadlines first, then the rest. */
export function groupsOf(day: Day, query: string): Group[] {
  const q = query.trim().toLowerCase();
  const matches = (p: Person) =>
    !q ||
    [p.name, p.role ?? "", day.index.companyOf(p)?.name ?? ""].some((v) =>
      v.toLowerCase().includes(q),
    );
  const upcoming = (o: Opportunity) =>
    o.deadline && o.deadline >= day.today ? o.deadline : "9999";
  const active = day.records.opportunities
    .filter((o) => o.status !== "closed")
    .toSorted((a, b) => upcoming(a).localeCompare(upcoming(b)));
  const groups: Group[] = active.map((o) => ({
    key: o.id,
    title: o.title,
    meta: [
      day.index.company(o.companyId)?.name,
      o.deadline && o.deadline >= day.today
        ? deadlineText(o.deadline, day.today)
        : STAGE_LABEL[o.status].toLowerCase(),
    ]
      .filter(Boolean)
      .join(" · "),
    people: day.index.peopleOf(o).filter(matches),
  }));
  const inActive = new Set<string>(active.flatMap((o) => o.personIds));
  const past = day.records.people.filter(
    (p) => !inActive.has(p.id) && day.index.opportunitiesOf(p.id).length > 0 && matches(p),
  );
  const unlinked = day.records.people.filter(
    (p) => day.index.opportunitiesOf(p.id).length === 0 && matches(p),
  );
  if (past.length) groups.push({ key: "past", title: "From closed opportunities", people: past });
  if (unlinked.length) groups.push({ key: "unlinked", title: "Not linked yet", people: unlinked });
  return groups.filter((g) => g.people.length > 0);
}

/** Opens on the most recent conversation, which is usually the one you came for. */
function mostRecentlyActive(day: Day): PersonId | undefined {
  return day.records.interactions.toSorted((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
    ?.personId;
}

/* ——— What to do next with this person ——— */

export function NextFromToday({
  ctx,
  day,
  announce,
}: {
  ctx: ItemContext;
  day: Day;
  announce: Announce;
}) {
  const actions = useItemActions(ctx, day, announce);
  return (
    <div className={s.nextPanel}>
      <div className={s.next}>
        {tileFor(ctx, day)}
        <span>
          <span className={s.nextTitle}>{headline(ctx)}</span>
          <Status ctx={ctx} className={s.nextMeta} />
        </span>
        {actions.mode ? (
          <button type="button" className={`${s.text} ${s.small}`} onClick={actions.close}>
            Hide draft
          </button>
        ) : (
          actions.primary && (
            <ActionButton spec={actions.primary} variant="primary" className={s.small} />
          )
        )}
      </div>
      {ctx.draft && actions.mode !== "edit" && (
        <div className={s.letter}>
          {ctx.draft.subject && <span className={s.letterSubject}>{ctx.draft.subject}</span>}
          {ctx.draft.body}
        </div>
      )}
      {actions.composer}
    </div>
  );
}

export function NextStep({
  person,
  day,
  announce,
}: {
  person: Person;
  day: Day;
  announce: Announce;
}) {
  const ctx = day.contexts.find((c) => c.person?.id === person.id);
  if (ctx) return <NextFromToday key={ctx.key} ctx={ctx} day={day} announce={announce} />;
  const next = day.index.openActionsFor(person.id)[0];
  if (!next) {
    return (
      <p className={s.whyMissing}>
        Nothing planned with {firstName(person.name)}. When there&apos;s a reason to get back in
        touch, add a next step and it will appear in Today.
      </p>
    );
  }
  const d = delta(day.today, next.dueOn);
  return (
    <div className={s.next}>
      <Tile date={next.dueOn} tone={d < 0 ? "late" : d === 0 ? "now" : undefined} />
      <span>
        <span className={s.nextTitle}>{next.title}</span>
        <span className={s.nextMeta}>
          {d === 0
            ? "Due today"
            : d === 1
              ? "Due tomorrow"
              : d < 0
                ? `${-d} days overdue`
                : `Due in ${d} days`}{" "}
          · {shortDay(next.dueOn)} · appears in Today nearer the time
        </span>
      </span>
      <button
        type="button"
        className={`${s.secondary} ${s.small}`}
        onClick={() => {
          day.complete(next.id);
          announce(`Done: ${next.title}.`);
        }}
      >
        <Icon.Check size={15} weight={2} /> Mark done
      </button>
    </div>
  );
}

/* ——— History: the relationship story, newest first, ending where it began ——— */

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

export function History({
  person,
  day,
  initial,
  dense = false,
}: {
  person: Person;
  day: Day;
  /** Phones: show the newest few, with a way to see the rest. Desktop shows everything. */
  initial?: number;
  /** Phones: set the history closer together. */
  dense?: boolean;
}) {
  const [all, setAll] = useState(false);
  const first = firstName(person.name);
  const tz = day.user.timeZone;
  const everything = day.index.historyOf(person.id).toReversed();
  const pending = day.index.pendingDraftsFor(person.id);
  const cap = initial === undefined || all ? Infinity : initial;
  const drafts = pending.slice(0, cap);
  const history = everything.slice(0, Math.max(0, cap - drafts.length));
  const hidden = pending.length + everything.length - drafts.length - history.length;
  // Where it began: when you added them, or your first exchange if that came earlier.
  const added = dayOf(person.createdAt, tz);
  const earliest = everything.at(-1);
  const firstContact = earliest ? dayOf(earliest.occurredAt, tz) : added;
  const found = firstContact < added ? firstContact : added;

  return (
    <>
      <ol className={s.timeline} data-dense={dense || undefined}>
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
        {hidden === 0 && (
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
        )}
      </ol>
      {hidden > 0 && (
        <button type="button" className={s.mMore} onClick={() => setAll(true)}>
          Show {hidden} earlier {hidden === 1 ? "moment" : "moments"}
          <Icon.ChevronDown size={14} weight={2} />
        </button>
      )}
    </>
  );
}

/* ——— What you know: facts, your words, and what was inferred ——— */

const PROVENANCE_ICON: Record<SourceFact["provenance"]["kind"], ReactNode> = {
  public_profile: <Icon.People size={13} weight={2} />,
  company_website: <Icon.Building size={13} weight={2} />,
  university_website: <Icon.Building size={13} weight={2} />,
  publication: <Icon.Note size={13} weight={2} />,
  event: <Icon.Calendar size={13} weight={2} />,
  correspondence: <Icon.Chat size={13} weight={2} />,
  other: <Icon.ArrowUpRight size={13} weight={2} />,
};

function Knowledge({ person, day }: { person: Person; day: Day }) {
  const company = day.index.companyOf(person);
  const first = firstName(person.name);
  const opportunities = day.index.opportunitiesOf(person.id);
  const personFacts = day.index.factsAbout({ type: "person", id: person.id });
  const companyFacts = company ? day.index.factsAbout({ type: "company", id: company.id }) : [];
  const number = new Map<string, number>(
    [...personFacts, ...companyFacts].map((f, i) => [f.id, i + 1]),
  );
  const readings = day.index.interpretationsAbout({ type: "person", id: person.id });

  const factList = (facts: SourceFact[]) => (
    <ol className={s.facts}>
      {facts.map((f) => (
        <li key={f.id} className={s.fact}>
          <span className={s.badge} aria-label={`Fact ${number.get(f.id)}`}>
            {number.get(f.id)}
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

  return (
    <aside className={s.side} aria-label={`What you know about ${first}`}>
      <section className={s.sideBlock} aria-labelledby="focus-opps">
        <h3 id="focus-opps" className={s.h3}>
          {opportunities.length === 1 ? "For" : "Connected to"}
        </h3>
        {opportunities.length === 0 ? (
          <p className={s.muted}>Not linked to anything you&apos;re pursuing.</p>
        ) : (
          opportunities.map((o) => {
            const others = day.index.peopleOf(o).filter((p) => p.id !== person.id);
            return (
              <div key={o.id} className={s.opp}>
                <span className={s.oppName}>{o.title}</span>
                <span className={s.oppMeta}>
                  {[
                    day.index.company(o.companyId)?.name,
                    STAGE_LABEL[o.status],
                    deadlineText(o.deadline, day.today),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {others.length > 0 && (
                  <span className={s.also}>
                    <span className={s.stack}>
                      {others.map((p) => (
                        <Avatar key={p.id} name={p.name} size={22} />
                      ))}
                    </span>
                    with {others.map((p) => firstName(p.name)).join(", ")}
                  </span>
                )}
              </div>
            );
          })
        )}
      </section>

      <section className={s.sideBlock} aria-labelledby="focus-facts">
        <h3 id="focus-facts" className={s.h3}>
          What you know <span>{personFacts.length + companyFacts.length} sourced</span>
        </h3>
        {personFacts.length === 0 && companyFacts.length === 0 ? (
          <p className={s.muted}>
            No facts yet. Note what you learn from their profile or a conversation, with where it
            came from.
          </p>
        ) : (
          <>
            {personFacts.length > 0 && factList(personFacts)}
            {companyFacts.length > 0 && (
              <>
                <p className={s.subhead}>About {company?.name}</p>
                {factList(companyFacts)}
              </>
            )}
          </>
        )}
      </section>

      <section className={s.sideBlock} aria-labelledby="focus-notes">
        <h3 id="focus-notes" className={s.h3}>
          Your notes <span>in your words</span>
        </h3>
        {person.notes ? (
          <p className={s.note}>{person.notes}</p>
        ) : (
          <p className={s.muted}>Nothing written yet.</p>
        )}
      </section>

      {readings.length > 0 && (
        <section className={s.sideBlock} aria-labelledby="focus-generated">
          <h3 id="focus-generated" className={s.h3}>
            Suggested angle <span>generated, not fact</span>
          </h3>
          {readings.map((r) => (
            <div key={r.id} className={s.generated}>
              {r.text}
              <span className={s.genMeta}>
                <Icon.Inferred size={13} weight={1.75} />
                Inferred from
                {r.basedOnFactIds.map((id) => (
                  <span key={id} className={s.badge} aria-label={`fact ${number.get(id) ?? "?"}`}>
                    {number.get(id) ?? "?"}
                  </span>
                ))}
                ·{" "}
                {r.review === "accepted"
                  ? "you kept it"
                  : r.review === "dismissed"
                    ? "dismissed"
                    : "not reviewed"}
              </span>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}

/* ——— The person ——— */

function Profile({ person, day, announce }: { person: Person; day: Day; announce: Announce }) {
  const company = day.index.companyOf(person);
  const first = firstName(person.name);

  return (
    <div className={s.profileInner}>
      <header className={s.personHead}>
        <Avatar name={person.name} size={72} />
        <div>
          <h2 className={s.personName}>{person.name}</h2>
          <p className={s.personRole}>
            {person.role}
            {company && (
              <>
                {person.role ? " at " : ""}
                <b>{company.name}</b>
              </>
            )}
            {person.location ? ` · ${person.location}` : ""}
          </p>
          <Standing person={person} day={day} />
        </div>
        <ContactActions person={person} />
      </header>

      <section className={s.why} aria-labelledby="focus-why">
        <h3 id="focus-why" className={s.whyLabel}>
          <Icon.Compass size={15} weight={2} />
          Why {first} matters
        </h3>
        {person.whyRelevant ? (
          <p className={s.whyText}>{person.whyRelevant}</p>
        ) : (
          <p className={s.whyMissing}>
            Not written yet. One sentence here makes every message to {first} easier to write.
          </p>
        )}
      </section>

      <NextStep person={person} day={day} announce={announce} />

      <div className={s.body}>
        <section aria-labelledby="focus-history">
          <h3 id="focus-history" className={s.h3}>
            Between you <span>{day.index.historyOf(person.id).length} moments</span>
          </h3>
          <History person={person} day={day} />
        </section>
        <Knowledge person={person} day={day} />
      </div>
    </div>
  );
}

export function People({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const { announce, view: toast } = useAnnouncer(day);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<PersonId | undefined>(
    () => personHandoff.id ?? mostRecentlyActive(day) ?? snapshot.people[0]?.id,
  );
  const groups = groupsOf(day, query);
  const order = [...new Set(groups.flatMap((g) => g.people.map((p) => p.id)))];
  const selected = day.index.person(selectedId);

  const onListKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    const at = selectedId ? order.indexOf(selectedId) : -1;
    const step = event.key === "ArrowDown" ? 1 : -1;
    const target = order[Math.min(Math.max(at + step, 0), order.length - 1)];
    if (!target) return;
    setSelectedId(target);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-person="${target}"]`)?.focus();
  };

  return (
    <AppFrame active="people" day={day} navigate={navigate}>
      <div className={s.people}>
        <nav
          className={`${s.list} ${s.scroll}`}
          aria-label="People by opportunity"
          onKeyDown={onListKey}
        >
          <div className={s.listHead}>
            <h1 className={s.pageTitle}>People</h1>
            <span className={s.dayCount}>{day.records.people.length}</span>
          </div>
          <label className={s.search}>
            <Icon.Search size={15} weight={1.75} />
            <input
              aria-label="Find a person"
              placeholder="Find by name, role or company"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {groups.length === 0 && <p className={s.empty}>No one matches “{query}”.</p>}
          {groups.map((g) => (
            <section key={g.key} className={s.group} aria-label={g.title}>
              <h2 className={s.groupHead}>
                <span className={s.groupTitle}>
                  <Icon.Target size={12} weight={2.25} />
                  {g.title}
                </span>
                {g.meta && <span className={s.groupMeta}>{g.meta}</span>}
              </h2>
              {g.people.map((p) => {
                const state = personState(
                  day.contexts.find((c) => c.person?.id === p.id),
                  p,
                );
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-person={p.id}
                    className={s.personRow}
                    aria-current={p.id === selectedId ? "true" : undefined}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <Avatar name={p.name} size={34} />
                    <span className={s.rowText}>
                      <span className={s.pName}>{p.name}</span>
                      <span className={s.pRole}>
                        {[p.role, day.index.companyOf(p)?.name].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={s.rowState} data-tone={state.tone}>
                      {state.tone && (
                        <span className={s.dot} data-tone={state.tone} aria-hidden="true" />
                      )}
                      {state.text}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
        <div className={`${s.profile} ${s.scroll}`}>
          {selected ? (
            <Profile key={selected.id} person={selected} day={day} announce={announce} />
          ) : (
            <p className={s.empty}>Choose someone to see why they matter.</p>
          )}
          {toast}
        </div>
      </div>
    </AppFrame>
  );
}
