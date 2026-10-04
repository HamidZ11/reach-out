"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import type { OpportunityId } from "@/domain/ids";
import type { Opportunity } from "@/domain/opportunity";
import { isPreApplication } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import { dayMonth, dayOf, shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import { capitalise, OUTREACH_LABEL, RELATIONSHIP_LABEL, STAGE_LABEL } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import type { Announce } from "./actions";
import { useAnnouncer } from "./actions";
import s from "./focus.module.css";
import type { OpportunityGroup } from "./kit";
import {
  Activity,
  CLOSED_LABEL,
  contextFor,
  deadlineTone,
  FactList,
  goToCompany,
  goToPerson,
  itemState,
  liveDeadline,
  MobileAction,
  openActionsOf,
  opportunityGroups,
  opportunityHandoff,
  peopleCount,
  PersonLine,
  PlannedAction,
  StageTrack,
  TYPE_LABEL,
} from "./kit";
import { PersonSheet } from "./mobile";
import { AppFrame, Avatar, Tile } from "./parts";
import { NextFromToday } from "./people";
import { MobileShell } from "./shell";
import k from "./surfaces.module.css";

/**
 * Pursuing: what you're going after, where each one stands, who you know
 * there and what happens next. Grouped by timing, never by funnel stage.
 */

/** "5 active · Ledgerline closes Fri 9 Oct" */
function summary(day: Day): string {
  const active = day.records.opportunities.filter((o) => o.status !== "closed");
  const soonest = active
    .flatMap((o) => {
      const deadline = liveDeadline(o, day.today);
      return deadline ? [{ o, deadline }] : [];
    })
    .toSorted((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const where = soonest && day.index.company(soonest.o.companyId)?.name;
  return [
    `${active.length} active`,
    soonest && `${where ?? soonest.o.title} closes ${shortDay(soonest.deadline)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function rowState(o: Opportunity, day: Day) {
  if (o.status === "closed") {
    return { text: o.closedReason ? CLOSED_LABEL[o.closedReason] : "Closed", tone: undefined };
  }
  const ctx = contextFor(o, day);
  return ctx ? itemState(ctx) : undefined;
}

function rowMeta(o: Opportunity, day: Day): string {
  return [
    day.index.company(o.companyId)?.name,
    o.status === "closed" ? (o.type ? TYPE_LABEL[o.type] : undefined) : STAGE_LABEL[o.status],
    peopleCount(o.personIds.length),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Opens on what you came for: a handed-over opportunity, or whatever closes first. */
function useSelection(day: Day, groups: OpportunityGroup[]) {
  const [selectedId, setSelectedId] = useState<OpportunityId | undefined>(() => {
    const handed = opportunityHandoff.id;
    return handed && day.index.opportunity(handed) ? handed : groups[0]?.items[0]?.id;
  });
  useEffect(() => {
    opportunityHandoff.id = undefined;
  }, []);
  return [selectedId, setSelectedId] as const;
}

/* ——— Desktop ——— */

function OpportunityRow({
  o,
  day,
  selected,
  onSelect,
}: {
  o: Opportunity;
  day: Day;
  selected: boolean;
  onSelect: () => void;
}) {
  const deadline = liveDeadline(o, day.today);
  const state = rowState(o, day);
  return (
    <button
      type="button"
      data-opportunity={o.id}
      className={k.oppRow}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
    >
      {deadline ? (
        <Tile small date={deadline} tone={deadlineTone(deadline, day.today)} />
      ) : (
        <span aria-hidden="true" />
      )}
      <span className={s.rowText}>
        <span className={k.oppRowTitle}>{o.title}</span>
        <span className={s.rowSub}>
          {rowMeta(o, day)}
          {deadline && <span className="sr-only">, closes {shortDay(deadline)}</span>}
        </span>
      </span>
      {state ? (
        <span className={s.rowState} data-tone={state.tone}>
          {state.tone && <span className={s.dot} data-tone={state.tone} aria-hidden="true" />}
          {state.text}
        </span>
      ) : (
        <span />
      )}
    </button>
  );
}

function OpportunityDetail({
  o,
  day,
  announce,
  navigate,
}: {
  o: Opportunity;
  day: Day;
  announce: Announce;
  navigate: SurfaceProps["navigate"];
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
  const interactions = day.records.interactions.filter(
    (i) => i.opportunityId === o.id || (!i.opportunityId && o.personIds.includes(i.personId)),
  );
  const drafts = day.records.drafts.filter(
    (d) =>
      d.opportunityId === o.id && (d.status === "awaiting_approval" || d.status === "approved"),
  );

  const openPerson = (p: Person) => goToPerson(navigate, p.id);
  const openCompany = () => company && goToCompany(navigate, company.id);

  return (
    <div className={s.profileInner}>
      <header className={k.detailHead}>
        <div>
          <h2 className={k.detailTitle}>{o.title}</h2>
          <p className={s.personRole}>
            {o.type ? TYPE_LABEL[o.type] : "Opportunity"}
            {company && (
              <>
                {" at "}
                <button type="button" className={k.inlineLink} onClick={openCompany}>
                  {company.name}
                </button>
              </>
            )}
            {company?.location ? ` · ${company.location}` : ""}
          </p>
          <p className={s.standing}>
            {deadline ? (
              <span className={s.tone} data-tone={deadlineTone(deadline, day.today)}>
                <span
                  className={s.dot}
                  data-tone={deadlineTone(deadline, day.today)}
                  aria-hidden="true"
                />
                Closes {shortDay(deadline)}
              </span>
            ) : (
              // A missed deadline matters only if you hadn't applied yet.
              o.deadline &&
              isPreApplication(o) && (
                <span className={s.tone} data-tone="late">
                  <span className={s.dot} data-tone="late" aria-hidden="true" />
                  Deadline passed {dayMonth(o.deadline)}
                </span>
              )
            )}
            {o.status !== "closed" && <span>{capitalise(o.priority ?? "medium")} priority</span>}
            <span>{capitalise(peopleCount(people.length))} involved</span>
          </p>
        </div>
        {o.url && (
          <a className={`${s.secondary} ${s.small}`} href={o.url} target="_blank" rel="noreferrer">
            Open the posting <Icon.ArrowUpRight size={15} weight={2} />
          </a>
        )}
      </header>

      <section className={k.block} aria-labelledby="opp-stage">
        <h3 id="opp-stage" className={s.h3}>
          Where you are
        </h3>
        <StageTrack o={o} />
      </section>

      {o.status !== "closed" && (
        <section className={k.block} aria-labelledby="opp-next">
          <h3 id="opp-next" className={s.h3}>
            What happens next
          </h3>
          {ctx ? (
            <NextFromToday key={ctx.key} ctx={ctx} day={day} announce={announce} />
          ) : planned[0] ? (
            <PlannedAction action={planned[0]} day={day} announce={announce} />
          ) : (
            <p className={s.whyMissing}>
              Nothing planned. Add a next step and it will appear in Today when it&apos;s due.
            </p>
          )}
          {ctx && after.length > 0 && (
            <div className={k.after}>
              <span className={k.afterLabel}>After that</span>
              <ul className={k.afterList}>
                {after.map((a) => (
                  <li key={a.id}>
                    <Tile small date={a.dueOn} tone={a.dueOn < day.today ? "late" : undefined} />
                    <span className={s.rowText}>
                      <span className={k.afterTitle}>{a.title}</span>
                      <span className={s.rowSub}>{shortDay(a.dueOn)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className={k.block} aria-labelledby="opp-people">
        <h3 id="opp-people" className={s.h3}>
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
                  onOpen={() => openPerson(p)}
                  context={theirs && theirs.id !== company?.id ? theirs.name : undefined}
                />
              );
            })}
          </div>
        ) : (
          <p className={s.whyMissing}>
            No one linked yet. Someone who has done this role, or works on the team, is usually the
            best way in.
          </p>
        )}
      </section>

      <div className={s.body}>
        <section aria-labelledby="opp-history">
          <h3 id="opp-history" className={s.h3}>
            What&apos;s happened <span>{interactions.length} moments</span>
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

        <aside className={s.side} aria-label="What you know">
          <section className={s.sideBlock} aria-labelledby="opp-notes">
            <h3 id="opp-notes" className={s.h3}>
              Your notes <span>in your words</span>
            </h3>
            {o.notes ? (
              <p className={s.note}>{o.notes}</p>
            ) : (
              <p className={s.muted}>Nothing written yet.</p>
            )}
          </section>

          <section className={s.sideBlock} aria-labelledby="opp-facts">
            <h3 id="opp-facts" className={s.h3}>
              What you know <span>{facts.length + companyFacts.length} sourced</span>
            </h3>
            {facts.length + companyFacts.length === 0 ? (
              <p className={s.muted}>
                No facts yet. Note what you learn from the posting or a conversation, with where it
                came from.
              </p>
            ) : (
              <>
                {facts.length > 0 && <FactList facts={facts} />}
                {companyFacts.length > 0 && (
                  <>
                    <p className={s.subhead}>About {company?.name}</p>
                    <FactList facts={companyFacts} first={facts.length + 1} />
                  </>
                )}
              </>
            )}
          </section>

          {readings.length > 0 && (
            <section className={s.sideBlock} aria-labelledby="opp-generated">
              <h3 id="opp-generated" className={s.h3}>
                Suggested angle <span>generated, not fact</span>
              </h3>
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
                  </span>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

export function Opportunities({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const { announce, view: toast } = useAnnouncer(day);
  const groups = opportunityGroups(day);
  const [selectedId, setSelectedId] = useSelection(day, groups);
  const selected = day.index.opportunity(selectedId);
  const order = groups.flatMap((g) => g.items.map((o) => o.id));
  const active = day.records.opportunities.filter((o) => o.status !== "closed").length;

  const onListKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const at = selectedId ? order.indexOf(selectedId) : -1;
    const target =
      order[Math.min(Math.max(at + (event.key === "ArrowDown" ? 1 : -1), 0), order.length - 1)];
    if (!target) return;
    setSelectedId(target);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-opportunity="${target}"]`)?.focus();
  };

  const rows = (items: Opportunity[]) => (
    <div className={k.rows}>
      {items.map((o) => (
        <OpportunityRow
          key={o.id}
          o={o}
          day={day}
          selected={o.id === selectedId}
          onSelect={() => setSelectedId(o.id)}
        />
      ))}
    </div>
  );

  return (
    <AppFrame active="opportunities" day={day} navigate={navigate}>
      <div className={k.split}>
        <nav
          className={`${s.list} ${s.scroll}`}
          aria-label="What you're pursuing"
          onKeyDown={onListKey}
        >
          <div className={s.listHead}>
            <h1 className={s.pageTitle}>Pursuing</h1>
            <span className={s.dayCount}>{active}</span>
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
                <h2 className={s.groupLabel}>{g.label}</h2>
                {rows(g.items)}
              </section>
            ),
          )}
        </nav>
        <div className={`${s.profile} ${s.scroll}`}>
          {selected ? (
            <OpportunityDetail
              key={selected.id}
              o={selected}
              day={day}
              announce={announce}
              navigate={navigate}
            />
          ) : (
            <p className={s.empty}>Choose an opportunity to see where it stands.</p>
          )}
          {toast}
        </div>
      </div>
    </AppFrame>
  );
}

/* ——— Phone: the list, then one opportunity at a time ——— */

function MobileDetail({
  o,
  day,
  announce,
  navigate,
  onPerson,
}: {
  o: Opportunity;
  day: Day;
  announce: Announce;
  navigate: SurfaceProps["navigate"];
  onPerson: (person: Person) => void;
}) {
  const company = day.index.company(o.companyId);
  const people = day.index.peopleOf(o);
  const ctx = contextFor(o, day);
  const planned = openActionsOf(o, day);
  const interactions = day.records.interactions.filter(
    (i) => i.opportunityId === o.id || (!i.opportunityId && o.personIds.includes(i.personId)),
  );
  const drafts = day.records.drafts.filter(
    (d) =>
      d.opportunityId === o.id && (d.status === "awaiting_approval" || d.status === "approved"),
  );

  return (
    <>
      {o.status !== "closed" && (
        <section className={k.mFirst} aria-labelledby="m-opp-next">
          <h2 id="m-opp-next" className={k.mLabel}>
            What happens next
          </h2>
          {ctx ? (
            <MobileAction key={ctx.key} ctx={ctx} day={day} announce={announce} />
          ) : planned[0] ? (
            <div className={k.mCard}>
              <div className={s.mHead}>
                <Tile date={planned[0].dueOn} tone={undefined} />
                <div>
                  <h3 className={s.mHeadline}>{planned[0].title}</h3>
                  <p className={s.mStatus}>
                    Due {shortDay(planned[0].dueOn)} · appears in Today nearer the time
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className={k.mQuiet}>Nothing planned yet.</p>
          )}
        </section>
      )}

      <section className={s.mSection} aria-labelledby="m-opp-stage">
        <div className={s.mSectionHead}>
          <h2 id="m-opp-stage" className={s.mSectionTitle}>
            Where you are
          </h2>
        </div>
        <div className={k.mCard}>
          <StageTrack o={o} compact />
        </div>
      </section>

      <section className={s.mSection} aria-labelledby="m-opp-people">
        <div className={s.mSectionHead}>
          <h2 id="m-opp-people" className={s.mSectionTitle}>
            Who you know there
          </h2>
          <span className={s.dayCount}>{people.length}</span>
        </div>
        {people.length > 0 ? (
          <ul className={s.mList}>
            {people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`${s.row} ${k.mPersonRow}`}
                  onClick={() => onPerson(p)}
                >
                  <Avatar name={p.name} size={38} />
                  <span className={s.rowText}>
                    <span className={s.rowTitle}>{p.name}</span>
                    <span className={s.rowSub}>
                      {OUTREACH_LABEL[day.outreachOf(p.id)]} ·{" "}
                      {RELATIONSHIP_LABEL[p.relationshipStatus]}
                    </span>
                  </span>
                  <Icon.ChevronRight size={18} weight={2} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={k.mQuiet}>No one linked yet.</p>
        )}
      </section>

      <section className={s.mSection} aria-labelledby="m-opp-history">
        <div className={s.mSectionHead}>
          <h2 id="m-opp-history" className={s.mSectionTitle}>
            What&apos;s happened
          </h2>
        </div>
        <div className={k.mCard}>
          <Activity
            day={day}
            interactions={interactions}
            drafts={drafts}
            origin={{
              date: dayOf(o.createdAt, day.user.timeZone),
              title: "You started pursuing this",
            }}
            empty="Nothing yet."
            initial={3}
            dense
          />
        </div>
      </section>

      {o.notes && (
        <section className={s.mSection} aria-labelledby="m-opp-notes">
          <div className={s.mSectionHead}>
            <h2 id="m-opp-notes" className={s.mSectionTitle}>
              Your notes
            </h2>
          </div>
          <p className={s.note}>{o.notes}</p>
        </section>
      )}

      {company && (
        <section className={s.mSection} aria-label="Company">
          <button
            type="button"
            className={s.mNext}
            onClick={() => goToCompany(navigate, company.id, o.id)}
          >
            <span className={k.mMarkCell}>
              <Icon.Building size={20} weight={1.75} />
            </span>
            <span className={s.rowText}>
              <span className={s.mNextTitle}>{company.name}</span>
              <span className={s.rowSub}>Everything you have there</span>
            </span>
            <Icon.ChevronRight size={18} weight={2} />
          </button>
        </section>
      )}
    </>
  );
}

export function OpportunitiesMobile({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const { announce, view: toast } = useAnnouncer(day);
  const groups = opportunityGroups(day);
  const [openId, setOpenId] = useState<OpportunityId | undefined>(() => {
    const handed = opportunityHandoff.id;
    return handed && day.index.opportunity(handed) ? handed : undefined;
  });
  const [sheet, setSheet] = useState<Person | null>(null);
  useEffect(() => {
    opportunityHandoff.id = undefined;
  }, []);
  const open = day.index.opportunity(openId);
  const overlay = sheet && (
    <PersonSheet key={sheet.id} person={sheet} day={day} onClose={() => setSheet(null)} />
  );

  if (open) {
    const company = day.index.company(open.companyId);
    const deadline = liveDeadline(open, day.today);
    const tone = deadline ? deadlineTone(deadline, day.today) : undefined;
    return (
      <MobileShell
        key={open.id}
        day={day}
        navigate={navigate}
        active="opportunities"
        title={open.title}
        subtitle={
          <>
            {[company?.name, open.type ? TYPE_LABEL[open.type] : undefined]
              .filter(Boolean)
              .join(" · ")}
            {deadline && (
              <span className={`${s.tone} ${k.mDeadline}`} data-tone={tone}>
                <span className={s.dot} data-tone={tone} aria-hidden="true" />
                Closes {shortDay(deadline)}
              </span>
            )}
          </>
        }
        back={{ label: "Pursuing", onClick: () => setOpenId(undefined) }}
        detail
        toast={toast}
        overlay={overlay}
      >
        <MobileDetail
          o={open}
          day={day}
          announce={announce}
          navigate={navigate}
          onPerson={setSheet}
        />
      </MobileShell>
    );
  }

  return (
    <MobileShell
      key="list"
      day={day}
      navigate={navigate}
      active="opportunities"
      title="Pursuing"
      subtitle={summary(day)}
      toast={toast}
    >
      {groups.map((g, i) => {
        const list = (
          <ul className={s.mList}>
            {g.items.map((o) => {
              const deadline = liveDeadline(o, day.today);
              const state = rowState(o, day);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`${s.row} ${k.mOppRow}`}
                    onClick={() => setOpenId(o.id)}
                  >
                    {deadline ? (
                      <Tile small date={deadline} tone={deadlineTone(deadline, day.today)} />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span className={s.rowText}>
                      <span className={s.rowTitle}>{o.title}</span>
                      <span className={s.rowSub}>
                        {rowMeta(o, day)}
                        {deadline && <span className="sr-only">, closes {shortDay(deadline)}</span>}
                      </span>
                    </span>
                    {state ? (
                      <span className={s.rowState} data-tone={state.tone}>
                        {state.tone && (
                          <span className={s.dot} data-tone={state.tone} aria-hidden="true" />
                        )}
                        {state.text}
                      </span>
                    ) : (
                      <span />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        );
        return g.key === "closed" ? (
          <details key={g.key} className={s.mSection}>
            <summary className={k.mClosedSummary}>
              {g.label} <span className={s.dayCount}>{g.items.length}</span>
            </summary>
            {list}
          </details>
        ) : (
          <section
            key={g.key}
            className={i === 0 ? k.mFirst : s.mSection}
            aria-labelledby={`m-group-${g.key}`}
          >
            <div className={s.mSectionHead}>
              <h2 id={`m-group-${g.key}`} className={s.mSectionTitle}>
                {g.label}
              </h2>
              <span className={s.dayCount}>{g.items.length}</span>
            </div>
            {list}
          </section>
        );
      })}
    </MobileShell>
  );
}
