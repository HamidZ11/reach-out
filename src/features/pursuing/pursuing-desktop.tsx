"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { dayMonth, dayOf, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { Opportunity } from "@/domain/opportunity";
import { isPreApplication } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import { FactList, Readings } from "@/features/people/knowledge";
import { NextFromToday, PlannedStep } from "@/features/people/people-desktop";
import pp from "@/features/people/people.module.css";
import { companyHref, personHref } from "@/features/sections";
import { DateTile, deadlineTone, liveDeadline } from "@/features/today/date-tile";
import type { Announce, Announcer } from "@/features/today/item-actions";
import { Standing } from "@/features/today/person";
import t from "@/features/today/today.module.css";
import { stableKey } from "@/features/today/wording";
import { capitalise } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { Activity } from "./activity";
import type { OpportunityGroup } from "./groups";
import { activityOf, contextFor, openActionsOf } from "./groups";
import k from "./pursuing.module.css";
import type { OpportunitySelection } from "./selection";
import { StageTrack } from "./stage-track";
import { peopleCount, rowMeta, rowState, summary, TYPE_LABEL } from "./wording";

/* ——— The list ——— */

function OpportunityRow({
  o,
  day,
  selected,
  onSelect,
}: {
  o: Opportunity;
  day: WorkspaceState;
  selected: boolean;
  onSelect: () => void;
}) {
  const deadline = liveDeadline(o, day.today);
  const state = rowState(o, day);
  return (
    <button
      type="button"
      className={k.oppRow}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
    >
      {deadline ? (
        <DateTile small date={deadline} tone={deadlineTone(deadline, day.today)} />
      ) : (
        <span aria-hidden="true" />
      )}
      <span className={t.rowText}>
        <span className={k.oppRowTitle}>{o.title}</span>
        <span className={t.rowSub}>{rowMeta(o, day)}</span>
        {/* Outside the truncated line, so it never pushes the row wider. */}
        {deadline && <span className="sr-only">, closes {shortDay(deadline)}</span>}
      </span>
      {state ? (
        <span className={pp.rowState} data-tone={state.tone}>
          {state.tone && <span className={t.dot} data-tone={state.tone} aria-hidden="true" />}
          {state.text}
        </span>
      ) : (
        <span />
      )}
    </button>
  );
}

/* ——— Who you know there, read the way People reads them ——— */

function PersonLine({
  person,
  day,
  context,
}: {
  person: Person;
  day: WorkspaceState;
  /** e.g. their company, when it isn't the opportunity's. */
  context?: string;
}) {
  return (
    <div className={k.personLine}>
      <Avatar name={person.name} size={40} />
      <div className={k.personLineText}>
        <Link href={personHref(person.id)} className={k.personLineName}>
          {person.name}
        </Link>
        <span className={k.personLineRole}>
          {[person.role, context].filter(Boolean).join(" · ")}
        </span>
        <Standing person={person} day={day} />
        {person.whyRelevant && <p className={k.personLineWhy}>{person.whyRelevant}</p>}
      </div>
    </div>
  );
}

/* ——— The opportunity ——— */

function OpportunityDetail({
  o,
  day,
  announce,
}: {
  o: Opportunity;
  day: WorkspaceState;
  announce: Announce;
}) {
  const company = day.index.company(o.companyId);
  const people = day.index.peopleOf(o);
  const ctx = contextFor(o, day);
  const planned = openActionsOf(o, day);
  const after = planned.filter((a) => a.id !== ctx?.action?.id);
  const deadline = liveDeadline(o, day.today);
  const facts = day.index.factsAbout({ type: "opportunity", id: o.id });
  const companyFacts = company ? day.index.factsAbout({ type: "company", id: company.id }) : [];
  const number = new Map<string, number>([...facts, ...companyFacts].map((f, i) => [f.id, i + 1]));
  const readings = day.index.interpretationsAbout({ type: "opportunity", id: o.id });
  const { interactions, drafts } = activityOf(o, day);

  return (
    <div className={pp.profileInner}>
      <header className={k.detailHead}>
        <div>
          <h2 className={k.detailTitle}>{o.title}</h2>
          <p className={pp.personRole}>
            {o.type ? TYPE_LABEL[o.type] : "Opportunity"}
            {company && (
              <>
                {" at "}
                <Link href={companyHref(company.id)} className={k.inlineLink}>
                  {company.name}
                </Link>
              </>
            )}
            {company?.location ? ` · ${company.location}` : ""}
          </p>
          <p className={t.standing}>
            {deadline ? (
              <span className={t.tone} data-tone={deadlineTone(deadline, day.today)}>
                <span
                  className={t.dot}
                  data-tone={deadlineTone(deadline, day.today)}
                  aria-hidden="true"
                />
                Closes {shortDay(deadline)}
              </span>
            ) : (
              // A missed deadline matters only if you hadn't applied yet.
              o.deadline &&
              isPreApplication(o) && (
                <span className={t.tone} data-tone="late">
                  <span className={t.dot} data-tone="late" aria-hidden="true" />
                  Deadline passed {dayMonth(o.deadline)}
                </span>
              )
            )}
            {o.status !== "closed" && <span>{capitalise(o.priority ?? "medium")} priority</span>}
            <span>{capitalise(peopleCount(people.length))} involved</span>
          </p>
        </div>
        {o.url && (
          <a className={`${t.secondary} ${t.small}`} href={o.url} target="_blank" rel="noreferrer">
            Open the posting <Icon.ArrowUpRight size={15} weight={2} />
          </a>
        )}
      </header>

      <section className={k.block} aria-labelledby="opp-stage">
        <h3 id="opp-stage" className={t.h3}>
          Where you are
        </h3>
        <StageTrack o={o} />
      </section>

      {o.status !== "closed" && (
        <section className={k.block} aria-labelledby="opp-next">
          <h3 id="opp-next" className={t.h3}>
            What happens next
          </h3>
          {ctx ? (
            <NextFromToday key={stableKey(ctx)} ctx={ctx} day={day} announce={announce} />
          ) : planned[0] ? (
            <PlannedStep action={planned[0]} day={day} announce={announce} />
          ) : (
            <p className={pp.whyMissing}>Nothing planned yet.</p>
          )}
          {ctx && after.length > 0 && (
            <div className={k.after}>
              <span className={k.afterLabel}>After that</span>
              <ul className={k.afterList}>
                {after.map((a) => (
                  <li key={a.id}>
                    <DateTile
                      small
                      date={a.dueOn}
                      tone={a.dueOn < day.today ? "late" : undefined}
                    />
                    <span className={t.rowText}>
                      <span className={k.afterTitle}>{a.title}</span>
                      <span className={t.rowSub}>{shortDay(a.dueOn)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className={k.block} aria-labelledby="opp-people">
        <h3 id="opp-people" className={t.h3}>
          Who you know there <span>{peopleCount(people.length)}</span>
        </h3>
        {people.length > 0 ? (
          <div className={k.peopleList}>
            {people.map((p) => {
              const theirs = day.index.companyOf(p);
              return (
                <PersonLine
                  key={p.id}
                  person={p}
                  day={day}
                  context={theirs && theirs.id !== company?.id ? theirs.name : undefined}
                />
              );
            })}
          </div>
        ) : (
          <p className={pp.whyMissing}>
            No one linked yet. Someone who has done this role, or works on the team, is usually the
            best way in.
          </p>
        )}
      </section>

      <div className={pp.body}>
        <section aria-labelledby="opp-history">
          <h3 id="opp-history" className={t.h3}>
            What&apos;s happened{" "}
            <span>{interactions.length === 1 ? "1 moment" : `${interactions.length} moments`}</span>
          </h3>
          <Activity
            day={day}
            interactions={interactions}
            drafts={drafts}
            origin={{
              date: dayOf(o.createdAt, day.user.timeZone),
              title: "You started pursuing this",
            }}
            empty="Nothing yet."
          />
        </section>

        <aside className={pp.side} aria-label="What you know">
          <section className={pp.sideBlock} aria-labelledby="opp-notes">
            <h3 id="opp-notes" className={t.h3}>
              Your notes <span>in your words</span>
            </h3>
            {o.notes ? (
              <p className={pp.note}>{o.notes}</p>
            ) : (
              <p className={pp.muted}>Nothing written yet.</p>
            )}
          </section>

          <section className={pp.sideBlock} aria-labelledby="opp-facts">
            <h3 id="opp-facts" className={t.h3}>
              What you know <span>{facts.length + companyFacts.length} sourced</span>
            </h3>
            {facts.length + companyFacts.length === 0 ? (
              <p className={pp.muted}>
                No facts yet. Note what you learn from the posting or a conversation, with where it
                came from.
              </p>
            ) : (
              <>
                {facts.length > 0 && <FactList facts={facts} />}
                {companyFacts.length > 0 && (
                  <>
                    <p className={pp.subhead}>About {company?.name}</p>
                    <FactList facts={companyFacts} first={facts.length + 1} />
                  </>
                )}
              </>
            )}
          </section>

          {readings.length > 0 && (
            <section className={pp.sideBlock} aria-labelledby="opp-generated">
              <h3 id="opp-generated" className={t.h3}>
                Suggested angle <span>generated, not fact</span>
              </h3>
              <Readings readings={readings} number={number} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Desktop Pursuing: what you're going after, grouped by timing, beside the
 * selected opportunity. The list is plain buttons in reading order — Tab moves
 * through it, Enter or Space selects. There are no single-key shortcuts.
 */
export function PursuingDesktop({
  day,
  groups,
  announcer,
  selection,
}: {
  day: WorkspaceState;
  groups: OpportunityGroup[];
  announcer: Announcer;
  selection: OpportunitySelection;
}) {
  const { announce, view: toast } = announcer;
  const { selectedId } = selection;
  const selected = day.index.opportunity(selectedId);
  const active = day.records.opportunities.filter((o) => o.status !== "closed").length;

  const rows = (items: Opportunity[]) => (
    <div className={k.rows}>
      {items.map((o) => (
        <OpportunityRow
          key={o.id}
          o={o}
          day={day}
          selected={o.id === selectedId}
          onSelect={() => selection.select(o.id)}
        />
      ))}
    </div>
  );

  return (
    <div className={k.split}>
      <nav className={`${pp.list} ${t.scroll}`} aria-label="What you're pursuing">
        <div className={pp.listHead}>
          <h1 className={t.pageTitle}>Pursuing</h1>
          <span className={t.dayCount}>{active}</span>
        </div>
        <p className={k.listSummary}>{summary(day)}</p>
        {groups.map((g) =>
          g.key === "closed" ? (
            <details key={g.key} className={k.closed} open={selected?.status === "closed"}>
              <summary className={k.closedSummary}>
                {g.label} <span>{g.items.length}</span>
              </summary>
              {rows(g.items)}
            </details>
          ) : (
            <section key={g.key} aria-label={g.label}>
              <h2 className={t.groupLabel}>{g.label}</h2>
              {rows(g.items)}
            </section>
          ),
        )}
      </nav>
      <div className={`${pp.profile} ${t.scroll}`}>
        {selected ? (
          <OpportunityDetail key={selected.id} o={selected} day={day} announce={announce} />
        ) : (
          <p className={pp.empty}>Choose an opportunity to see where it stands.</p>
        )}
        {toast}
      </div>
    </div>
  );
}
