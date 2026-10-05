"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { delta, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { NextAction } from "@/domain/next-action";
import type { Person } from "@/domain/person";
import { DateTile, tileFor } from "@/features/today/date-tile";
import type { Announce, Announcer } from "@/features/today/item-actions";
import { ActionButton, useItemActions } from "@/features/today/item-actions";
import { ContactActions, History, Standing, Status } from "@/features/today/person";
import t from "@/features/today/today.module.css";
import { headline, personState, stableKey } from "@/features/today/wording";
import type { ItemContext } from "@/features/workspace/records";
import { deadlineText, firstName, STAGE_LABEL } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { groupsOf } from "./groups";
import { FactList, knowledgeOf, Readings } from "./knowledge";
import p from "./people.module.css";
import type { PersonSelection } from "./selection";

/* ——— What to do next with this person ——— */

/** Today is asking something of this person or opportunity: act on it here, with Today's verbs. */
export function NextFromToday({
  ctx,
  day,
  announce,
}: {
  ctx: ItemContext;
  day: WorkspaceState;
  announce: Announce;
}) {
  const actions = useItemActions(ctx, day, announce);
  return (
    <div className={p.nextPanel}>
      <div className={p.next}>
        {tileFor(ctx, day)}
        <span>
          <span className={p.nextTitle}>{headline(ctx)}</span>
          <Status ctx={ctx} className={p.nextMeta} />
        </span>
        {actions.mode ? (
          <button type="button" className={`${t.text} ${t.small}`} onClick={actions.close}>
            Hide draft
          </button>
        ) : (
          actions.primary && (
            <ActionButton spec={actions.primary} variant="primary" className={t.small} />
          )
        )}
      </div>
      {ctx.draft && actions.mode !== "edit" && (
        <div className={t.letter}>
          {ctx.draft.subject && <span className={t.letterSubject}>{ctx.draft.subject}</span>}
          {ctx.draft.body}
        </div>
      )}
      {actions.composer}
    </div>
  );
}

/** A step planned further out than Today looks. */
export function PlannedStep({
  action,
  day,
  announce,
}: {
  action: NextAction;
  day: WorkspaceState;
  announce: Announce;
}) {
  const d = delta(day.today, action.dueOn);
  return (
    <div className={p.next}>
      <DateTile date={action.dueOn} tone={d < 0 ? "late" : d === 0 ? "now" : undefined} />
      <span>
        <span className={p.nextTitle}>{action.title}</span>
        <span className={p.nextMeta}>
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
        className={`${t.secondary} ${t.small}`}
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

function NextStep({
  person,
  day,
  announce,
}: {
  person: Person;
  day: WorkspaceState;
  announce: Announce;
}) {
  const ctx = day.contexts.find((c) => c.person?.id === person.id);
  if (ctx) return <NextFromToday key={stableKey(ctx)} ctx={ctx} day={day} announce={announce} />;
  const planned = day.index.openActionsFor(person.id)[0];
  if (planned) return <PlannedStep action={planned} day={day} announce={announce} />;
  return <p className={p.whyMissing}>Nothing planned yet.</p>;
}

/* ——— What you know: what it's for, facts, your words, and what was inferred ——— */

function Knowledge({ person, day }: { person: Person; day: WorkspaceState }) {
  const first = firstName(person.name);
  const opportunities = day.index.opportunitiesOf(person.id);
  const { company, personFacts, companyFacts, number, readings } = knowledgeOf(person, day);

  return (
    <aside className={p.side} aria-label={`What you know about ${first}`}>
      <section className={p.sideBlock} aria-labelledby="person-opps">
        <h3 id="person-opps" className={t.h3}>
          {opportunities.length === 1 ? "For" : "Connected to"}
        </h3>
        {opportunities.length === 0 ? (
          <p className={p.muted}>Not linked to anything you&apos;re pursuing.</p>
        ) : (
          opportunities.map((o) => {
            const others = day.index.peopleOf(o).filter((other) => other.id !== person.id);
            return (
              <div key={o.id} className={p.opp}>
                <span className={t.oppName}>{o.title}</span>
                <span className={p.oppMeta}>
                  {[
                    day.index.company(o.companyId)?.name,
                    STAGE_LABEL[o.status],
                    deadlineText(o.deadline, day.today),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {others.length > 0 && (
                  <span className={p.also}>
                    <span className={t.stack}>
                      {others.map((other) => (
                        <Avatar key={other.id} name={other.name} size={22} />
                      ))}
                    </span>
                    with {others.map((other) => firstName(other.name)).join(", ")}
                  </span>
                )}
              </div>
            );
          })
        )}
      </section>

      <section className={p.sideBlock} aria-labelledby="person-facts">
        <h3 id="person-facts" className={t.h3}>
          What you know <span>{personFacts.length + companyFacts.length} sourced</span>
        </h3>
        {personFacts.length === 0 && companyFacts.length === 0 ? (
          <p className={p.muted}>
            No facts yet. Note what you learn from their profile or a conversation, with where it
            came from.
          </p>
        ) : (
          <>
            {personFacts.length > 0 && <FactList facts={personFacts} />}
            {companyFacts.length > 0 && (
              <>
                <p className={p.subhead}>About {company?.name}</p>
                <FactList facts={companyFacts} first={personFacts.length + 1} />
              </>
            )}
          </>
        )}
      </section>

      <section className={p.sideBlock} aria-labelledby="person-notes">
        <h3 id="person-notes" className={t.h3}>
          Your notes <span>in your words</span>
        </h3>
        {person.notes ? (
          <p className={p.note}>{person.notes}</p>
        ) : (
          <p className={p.muted}>Nothing written yet.</p>
        )}
      </section>

      {readings.length > 0 && (
        <section className={p.sideBlock} aria-labelledby="person-generated">
          <h3 id="person-generated" className={t.h3}>
            Suggested angle <span>generated, not fact</span>
          </h3>
          <Readings readings={readings} number={number} />
        </section>
      )}
    </aside>
  );
}

/* ——— The person ——— */

function Profile({
  person,
  day,
  announce,
}: {
  person: Person;
  day: WorkspaceState;
  announce: Announce;
}) {
  const company = day.index.companyOf(person);
  const first = firstName(person.name);
  const moments = day.index.historyOf(person.id).length;

  return (
    <div className={p.profileInner}>
      <header className={p.personHead}>
        <Avatar name={person.name} size={72} />
        <div>
          <h2 className={p.personName}>{person.name}</h2>
          <p className={p.personRole}>
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

      <section className={t.why} aria-labelledby="person-why">
        <h3 id="person-why" className={t.whyLabel}>
          <Icon.Compass size={15} weight={2} />
          Why {first} matters
        </h3>
        {person.whyRelevant ? (
          <p className={t.whyText}>{person.whyRelevant}</p>
        ) : (
          <p className={p.whyMissing}>
            Not written yet. One sentence here makes every message to {first} easier to write.
          </p>
        )}
      </section>

      <NextStep person={person} day={day} announce={announce} />

      <div className={p.body}>
        <section aria-labelledby="person-history">
          <h3 id="person-history" className={t.h3}>
            Between you <span>{moments === 1 ? "1 moment" : `${moments} moments`}</span>
          </h3>
          <History person={person} day={day} />
        </section>
        <Knowledge person={person} day={day} />
      </div>
    </div>
  );
}

/**
 * Desktop People: an opportunity-grouped list beside the selected person. The
 * list is plain buttons in reading order — Tab moves through it, Enter or
 * Space selects. There are no single-key shortcuts.
 */
export function PeopleDesktop({
  day,
  announcer,
  selection,
}: {
  day: WorkspaceState;
  announcer: Announcer;
  selection: PersonSelection;
}) {
  const { announce, view: toast } = announcer;
  const [query, setQuery] = useState("");
  const { selectedId } = selection;
  const groups = groupsOf(day, query);
  const selected = day.index.person(selectedId);

  return (
    <div className={p.people}>
      <nav className={`${p.list} ${t.scroll}`} aria-label="People by opportunity">
        <div className={p.listHead}>
          <h1 className={t.pageTitle}>People</h1>
          <span className={t.dayCount}>{day.records.people.length}</span>
        </div>
        <label className={p.search}>
          <Icon.Search size={15} weight={1.75} />
          <input
            aria-label="Find a person"
            placeholder="Find by name, role or company"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {groups.length === 0 && <p className={p.empty}>No one matches “{query}”.</p>}
        {groups.map((g) => (
          <section key={g.key} className={p.group} aria-label={g.title}>
            <h2 className={p.groupHead}>
              <span className={p.groupTitle}>
                <Icon.Target size={12} weight={2.25} />
                {g.title}
              </span>
              {g.meta && <span className={p.groupMeta}>{g.meta}</span>}
            </h2>
            {g.people.map((person) => {
              const state = personState(
                day.contexts.find((c) => c.person?.id === person.id),
                person,
              );
              return (
                <button
                  key={person.id}
                  type="button"
                  className={p.personRow}
                  aria-current={person.id === selectedId ? "true" : undefined}
                  onClick={() => selection.select(person.id)}
                >
                  <Avatar name={person.name} size={34} />
                  <span className={t.rowText}>
                    <span className={p.pName}>{person.name}</span>
                    <span className={p.pRole}>
                      {[person.role, day.index.companyOf(person)?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={p.rowState} data-tone={state.tone}>
                    {state.tone && (
                      <span className={t.dot} data-tone={state.tone} aria-hidden="true" />
                    )}
                    {state.text}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </nav>
      <div className={`${p.profile} ${t.scroll}`}>
        {selected ? (
          <Profile key={selected.id} person={selected} day={day} announce={announce} />
        ) : (
          <p className={p.empty}>Choose someone to see why they matter.</p>
        )}
        {toast}
      </div>
    </div>
  );
}
