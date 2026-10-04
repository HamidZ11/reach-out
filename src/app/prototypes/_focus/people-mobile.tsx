"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { PersonId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import { shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import { countWord, firstName, STAGE_LABEL } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import type { Announce } from "./actions";
import { useAnnouncer } from "./actions";
import s from "./focus.module.css";
import { deadlineTone, FactList, goToOpportunity, liveDeadline, MobileAction } from "./kit";
import { Avatar, ContactActions, personHandoff, personState, Standing, Tile } from "./parts";
import { groupsOf, History } from "./people";
import { MobileShell } from "./shell";
import k from "./surfaces.module.css";

/**
 * People on a phone: the list, then one person at a time. Desktop's two
 * columns become a flow. The person reads in order of what matters: why they
 * matter, what's next, what it's for, what has happened, what you know.
 */

/* ——— One person ——— */

/** Folds lower-priority knowledge into one tappable row, opened on request. */
function More({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <details className={k.pMore}>
      <summary className={k.pMoreSummary}>
        <span className={k.pMoreTitle}>{title}</span>
        <span className={k.pMoreNote}>{note}</span>
        <Icon.ChevronDown size={16} weight={2} />
      </summary>
      <div className={k.pMoreBody}>{children}</div>
    </details>
  );
}

function PersonPage({
  person,
  day,
  announce,
  navigate,
}: {
  person: Person;
  day: Day;
  announce: Announce;
  navigate: SurfaceProps["navigate"];
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const first = firstName(person.name);
  const company = day.index.companyOf(person);
  const ctx = day.contexts.find((c) => c.person?.id === person.id);
  const planned = day.index.openActionsFor(person.id)[0];
  const opportunities = day.index.opportunitiesOf(person.id);
  const moments = day.index.historyOf(person.id).length;
  const facts = day.index.factsAbout({ type: "person", id: person.id });
  const companyFacts = company ? day.index.factsAbout({ type: "company", id: company.id }) : [];
  const sourced = facts.length + companyFacts.length;
  const number = new Map<string, number>([...facts, ...companyFacts].map((f, i) => [f.id, i + 1]));
  const readings = day.index.interpretationsAbout({ type: "person", id: person.id });
  const why = person.whyRelevant;
  const long = why !== undefined && why.length > 110;

  return (
    <>
      <div className={k.mStanding}>
        <Standing person={person} day={day} />
      </div>

      <section className={k.mWhyBlock} aria-labelledby="m-person-why">
        <h2 id="m-person-why" className={s.whyLabel}>
          <Icon.Compass size={14} weight={2} />
          Why {first} matters
        </h2>
        {why ? (
          <>
            <p className={long && !whyOpen ? `${k.mWhyStatement} ${k.clamp3}` : k.mWhyStatement}>
              {why}
            </p>
            {long && !whyOpen && (
              <button type="button" className={s.mMore} onClick={() => setWhyOpen(true)}>
                Read all <Icon.ChevronDown size={14} weight={2} />
              </button>
            )}
          </>
        ) : (
          <p className={k.mWhyMissing}>
            Not written yet. One sentence here makes every message to {first} easier.
          </p>
        )}
      </section>

      <section className={k.pSection} aria-labelledby="m-person-next">
        <div className={s.mSectionHead}>
          <h2 id="m-person-next" className={s.mSectionTitle}>
            Next
          </h2>
        </div>
        {ctx ? (
          <MobileAction key={ctx.key} ctx={ctx} day={day} announce={announce} compact />
        ) : planned ? (
          <div className={`${k.mCard} ${k.cCard}`}>
            <div className={k.cHead}>
              <Tile
                small
                date={planned.dueOn}
                tone={planned.dueOn < day.today ? "late" : undefined}
              />
              <div className={s.rowText}>
                <h3 className={k.cHeadline}>{planned.title}</h3>
                <p className={k.cStatus}>
                  Due {shortDay(planned.dueOn)} · appears in Today nearer the time
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className={k.mQuiet}>
            Nothing planned with {first}. When there&apos;s a reason to get back in touch, it will
            appear in Today.
          </p>
        )}
      </section>

      {opportunities.length > 0 && (
        <section className={k.pSection} aria-labelledby="m-person-for">
          <div className={s.mSectionHead}>
            <h2 id="m-person-for" className={s.mSectionTitle}>
              {opportunities.length === 1 ? "For" : "Connected to"}
            </h2>
          </div>
          <ul className={s.mList}>
            {opportunities.map((o) => {
              const deadline = liveDeadline(o, day.today);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`${s.row} ${k.mOppRow} ${k.pRow}`}
                    onClick={() => goToOpportunity(navigate, o.id)}
                  >
                    {deadline ? (
                      <Tile small date={deadline} tone={deadlineTone(deadline, day.today)} />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span className={s.rowText}>
                      <span className={`${s.rowTitle} ${s.oppName}`}>{o.title}</span>
                      <span className={s.rowSub}>
                        {[day.index.company(o.companyId)?.name, STAGE_LABEL[o.status]]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <Icon.ChevronRight size={18} weight={2} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={k.pSection} aria-labelledby="m-person-history">
        <div className={s.mSectionHead}>
          <h2 id="m-person-history" className={s.mSectionTitle}>
            Between you
          </h2>
          <span className={s.dayCount}>
            {moments === 1 ? "1 moment" : `${countWord(moments)} moments`}
          </span>
        </div>
        <div className={`${k.mCard} ${k.pHistory}`}>
          <History person={person} day={day} initial={3} dense />
        </div>
      </section>

      <section className={k.pSection} aria-labelledby="m-person-know">
        <div className={s.mSectionHead}>
          <h2 id="m-person-know" className={s.mSectionTitle}>
            What you know
          </h2>
        </div>
        {person.notes ? (
          <p className={`${s.note} ${k.pNote}`}>
            <span className={k.pNoteLabel}>Your note</span>
            {person.notes}
          </p>
        ) : (
          <p className={k.mQuiet}>No notes yet.</p>
        )}
        <div className={k.pFolds}>
          {sourced > 0 ? (
            <More title="Sourced facts" note={`${sourced} with where they came from`}>
              {facts.length > 0 && <FactList facts={facts} />}
              {companyFacts.length > 0 && (
                <>
                  <p className={s.subhead}>About {company?.name}</p>
                  <FactList facts={companyFacts} first={facts.length + 1} />
                </>
              )}
            </More>
          ) : (
            <p className={k.mQuiet}>No sourced facts yet.</p>
          )}
          {readings.length > 0 && (
            <More title="Suggested angle" note="generated, not fact">
              {readings.map((r) => (
                <div key={r.id} className={s.generated}>
                  {r.text}
                  <span className={s.genMeta}>
                    <Icon.Inferred size={13} weight={1.75} />
                    Inferred from
                    {r.basedOnFactIds.map((id) => (
                      <span key={id} className={s.badge}>
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
            </More>
          )}
        </div>
      </section>
    </>
  );
}

/* ——— The list ——— */

export function PeopleMobile({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const { announce, view: toast } = useAnnouncer(day);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<PersonId | undefined>(() => {
    const handed = personHandoff.id;
    return handed && day.index.person(handed) ? handed : undefined;
  });
  useEffect(() => {
    personHandoff.id = undefined;
  }, []);
  const open = day.index.person(openId);

  if (open) {
    const company = day.index.companyOf(open);
    return (
      <MobileShell
        key={open.id}
        day={day}
        navigate={navigate}
        active="people"
        title={open.name}
        subtitle={[open.role, company?.name].filter(Boolean).join(" · ")}
        leading={<Avatar name={open.name} size={44} />}
        trailing={
          <span className={k.mContacts}>
            <ContactActions person={open} />
          </span>
        }
        back={{ label: "People", onClick: () => setOpenId(undefined) }}
        detail
        tight
        toast={toast}
      >
        <PersonPage person={open} day={day} announce={announce} navigate={navigate} />
      </MobileShell>
    );
  }

  const groups = groupsOf(day, query);
  const waiting = new Set(day.contexts.flatMap((c) => (c.person ? [c.person.id] : []))).size;

  return (
    <MobileShell
      key="list"
      day={day}
      navigate={navigate}
      active="people"
      title="People"
      subtitle={`${day.records.people.length} people · ${countWord(waiting)} need you`}
      toast={toast}
    >
      <label className={k.mSearch}>
        <Icon.Search size={17} weight={1.75} />
        <input
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="Find a person"
          placeholder="Name, role or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {groups.length === 0 && <p className={k.mQuiet}>No one matches “{query}”.</p>}

      {groups.map((g) => (
        <section key={g.key} className={s.mSection} aria-label={g.title}>
          <div className={k.mGroupHead}>
            <h2 className={k.mGroupTitle}>
              {g.key !== "past" && g.key !== "unlinked" && <Icon.Target size={14} weight={2.25} />}
              {g.title}
            </h2>
            {g.meta && <span className={k.mGroupMeta}>{g.meta}</span>}
          </div>
          <ul className={s.mList}>
            {g.people.map((p) => {
              const state = personState(
                day.contexts.find((c) => c.person?.id === p.id),
                p,
              );
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`${s.row} ${k.mPeopleRow}`}
                    onClick={() => setOpenId(p.id)}
                  >
                    <Avatar name={p.name} size={40} />
                    <span className={s.rowText}>
                      <span className={k.nameLine}>
                        <span className={s.rowTitle}>{p.name}</span>
                        <span className={`${s.rowState} ${k.lineState}`} data-tone={state.tone}>
                          {state.tone && (
                            <span className={s.dot} data-tone={state.tone} aria-hidden="true" />
                          )}
                          {state.text}
                        </span>
                      </span>
                      <span className={s.rowSub}>
                        {[p.role, day.index.companyOf(p)?.name].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </MobileShell>
  );
}
