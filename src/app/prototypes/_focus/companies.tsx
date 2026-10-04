"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import type { Company } from "@/domain/company";
import type { CompanyId, OpportunityId } from "@/domain/ids";
import type { Opportunity } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import { ago, shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import { countWord, firstName, OUTREACH_LABEL, STAGE_LABEL } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import s from "./focus.module.css";
import {
  Activity,
  CLOSED_LABEL,
  companyHandoff,
  contextFor,
  deadlineTone,
  FactList,
  goToOpportunity,
  goToPerson,
  itemState,
  liveDeadline,
  Mark,
  peopleCount,
  PersonLine,
  TYPE_LABEL,
} from "./kit";
import { PersonSheet } from "./mobile";
import { AppFrame, Avatar, Tile } from "./parts";
import { MobileShell } from "./shell";
import k from "./surfaces.module.css";

/**
 * Companies: derived context, never a database to maintain (D-012). Each one
 * gathers what you're pursuing there, who you know, and what has happened.
 */

function gather(c: Company, day: Day) {
  const opportunities = day.records.opportunities.filter((o) => o.companyId === c.id);
  const active = opportunities.filter((o) => o.status !== "closed");
  const people = day.records.people.filter((p) => p.companyId === c.id);
  const ids = new Set<string>(people.map((p) => p.id));
  const oppIds = new Set<string>(opportunities.map((o) => o.id));
  const interactions = day.records.interactions.filter(
    (i) => ids.has(i.personId) || (i.opportunityId !== undefined && oppIds.has(i.opportunityId)),
  );
  const drafts = day.records.drafts.filter(
    (d) => ids.has(d.personId) && (d.status === "awaiting_approval" || d.status === "approved"),
  );
  const latest = interactions.toSorted((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const ctx = day.contexts.find(
    (x) => (x.opportunity && oppIds.has(x.opportunity.id)) || (x.person && ids.has(x.person.id)),
  );
  const deadline = active
    .map((o) => liveDeadline(o, day.today))
    .filter((d) => d !== undefined)
    .toSorted()[0];
  return { opportunities, active, people, interactions, drafts, latest, ctx, deadline };
}

/** Companies with something closing first, then the most recently active. */
function ordered(day: Day): Company[] {
  return day.records.companies.toSorted((a, b) => {
    const x = gather(a, day);
    const y = gather(b, day);
    const needs = (ctx: typeof x.ctx) => (ctx ? day.contexts.indexOf(ctx) : Infinity);
    return (
      (x.deadline ?? "9999").localeCompare(y.deadline ?? "9999") ||
      needs(x.ctx) - needs(y.ctx) ||
      (y.latest?.occurredAt ?? "").localeCompare(x.latest?.occurredAt ?? "") ||
      a.name.localeCompare(b.name)
    );
  });
}

/** Your strongest tie there, in words. Relationship first, never a score. */
function tieClause(people: Person[], day: Day): string {
  const by = (status: Person["relationshipStatus"]) =>
    people.find((p) => p.relationshipStatus === status);
  const warm = by("warm");
  if (warm) return `you're on good terms with ${firstName(warm.name)}`;
  const replied = by("replied");
  if (replied) return `${firstName(replied.name)} has replied`;
  const drafted = people.find((p) => day.outreachOf(p.id) === "draft");
  if (drafted) return `your draft to ${firstName(drafted.name)} is waiting`;
  const contacted = by("contacted");
  if (contacted) return `you've written to ${firstName(contacted.name)}`;
  const dormant = by("dormant");
  if (dormant) return `it's gone quiet with ${firstName(dormant.name)}`;
  return "you haven't been in touch yet";
}

/** Why this company matters, said from the records: what you pursue and who you know. */
function whyLine(view: ReturnType<typeof gather>, day: Day): string {
  const { active, people } = view;
  const pursuing =
    active.length === 0
      ? "Nothing is active here right now"
      : active.length === 1
        ? `You're pursuing “${active[0]?.title}” here`
        : `You're pursuing ${countWord(active.length)} things here`;
  const knowing =
    people.length === 0
      ? "but you don't know anyone there yet"
      : `and know ${people.length === 1 ? "one person" : `${countWord(people.length)} people`} — ${tieClause(people, day)}`;
  return `${pursuing}, ${knowing}.`;
}

function standing(view: ReturnType<typeof gather>, day: Day): string[] {
  return [
    view.active.length === 1
      ? "1 active opportunity"
      : `${view.active.length} active opportunities`,
    peopleCount(view.people.length),
    view.latest
      ? `last contact ${ago(day.index.daysSince(view.latest.occurredAt))}`
      : "no contact yet",
  ];
}

/* ——— Desktop ——— */

function PursuitLine({ o, day, onOpen }: { o: Opportunity; day: Day; onOpen: () => void }) {
  const deadline = liveDeadline(o, day.today);
  const ctx = contextFor(o, day);
  const state =
    o.status === "closed"
      ? { text: o.closedReason ? CLOSED_LABEL[o.closedReason] : "Closed", tone: undefined }
      : ctx
        ? itemState(ctx)
        : undefined;
  return (
    <button
      type="button"
      className={k.pursuit}
      data-closed={o.status === "closed" || undefined}
      onClick={onOpen}
    >
      {deadline ? (
        <Tile small date={deadline} tone={deadlineTone(deadline, day.today)} />
      ) : (
        <span aria-hidden="true" />
      )}
      <span className={s.rowText}>
        <span className={`${k.pursuitTitle} ${s.oppName}`}>{o.title}</span>
        <span className={s.rowSub}>
          {[
            o.type ? TYPE_LABEL[o.type] : undefined,
            STAGE_LABEL[o.status],
            deadline ? `closes ${shortDay(deadline)}` : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
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

function CompanyDetail({
  c,
  day,
  navigate,
}: {
  c: Company;
  day: Day;
  navigate: SurfaceProps["navigate"];
}) {
  const view = gather(c, day);
  const facts = day.index.factsAbout({ type: "company", id: c.id });
  const pursued = [...view.active, ...view.opportunities.filter((o) => o.status === "closed")];
  const openOpportunity = (o: Opportunity) => goToOpportunity(navigate, o.id);
  const openPerson = (p: Person) => goToPerson(navigate, p.id);

  return (
    <div className={s.profileInner}>
      <header className={k.companyHead}>
        <Mark name={c.name} size={64} />
        <div>
          <h2 className={s.personName}>{c.name}</h2>
          <p className={s.personRole}>{[c.sector, c.location].filter(Boolean).join(" · ")}</p>
          <p className={s.standing}>
            {standing(view, day).map((part) => (
              <span key={part}>{part}</span>
            ))}
          </p>
        </div>
        {c.website && (
          <a
            className={s.iconLink}
            href={c.website}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${c.name}'s website`}
            title={c.website}
          >
            <Icon.ArrowUpRight size={18} weight={1.75} />
          </a>
        )}
      </header>

      <section className={k.companyWhy} aria-labelledby="company-why">
        <h3 id="company-why" className={s.whyLabel}>
          <Icon.Compass size={15} weight={2} />
          Why {c.name} matters
        </h3>
        <p className={k.companyWhyText}>{whyLine(view, day)}</p>
        <p className={k.derived}>From what you&apos;re pursuing and who you know there.</p>
      </section>

      <section className={k.block} aria-labelledby="company-pursuing">
        <h3 id="company-pursuing" className={s.h3}>
          What you&apos;re pursuing here <span>{view.active.length} active</span>
        </h3>
        {pursued.length > 0 ? (
          <div className={k.pursuits}>
            {pursued.map((o) => (
              <PursuitLine key={o.id} o={o} day={day} onOpen={() => openOpportunity(o)} />
            ))}
          </div>
        ) : (
          <p className={s.muted}>Nothing yet.</p>
        )}
      </section>

      <section className={k.block} aria-labelledby="company-people">
        <h3 id="company-people" className={s.h3}>
          Who you know here <span>{peopleCount(view.people.length)}</span>
        </h3>
        {view.people.length > 0 ? (
          <div className={k.peopleList}>
            {view.people.map((p) => (
              <PersonLine key={p.id} person={p} day={day} onOpen={() => openPerson(p)} />
            ))}
          </div>
        ) : (
          <p className={s.muted}>No one yet.</p>
        )}
      </section>

      <div className={s.body}>
        <section aria-labelledby="company-history">
          <h3 id="company-history" className={s.h3}>
            What&apos;s happened <span>{view.interactions.length} moments</span>
          </h3>
          <Activity
            day={day}
            interactions={view.interactions}
            drafts={view.drafts}
            empty="Nothing has happened here yet."
          />
        </section>
        <aside className={s.side} aria-label={`What you know about ${c.name}`}>
          <section className={s.sideBlock} aria-labelledby="company-notes">
            <h3 id="company-notes" className={s.h3}>
              Your notes <span>in your words</span>
            </h3>
            {c.notes ? (
              <p className={s.note}>{c.notes}</p>
            ) : (
              <p className={s.muted}>Nothing written yet.</p>
            )}
          </section>
          <section className={s.sideBlock} aria-labelledby="company-facts">
            <h3 id="company-facts" className={s.h3}>
              What you know <span>{facts.length} sourced</span>
            </h3>
            {facts.length > 0 ? (
              <FactList facts={facts} />
            ) : (
              <p className={s.muted}>No sourced facts yet.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function useCompanySelection(day: Day, fallback: CompanyId | undefined) {
  const [id, setId] = useState<CompanyId | undefined>(() => {
    const handed = companyHandoff.id;
    return handed && day.index.company(handed) ? handed : fallback;
  });
  // On a phone, a company opened from an opportunity goes Back to that opportunity.
  const [from] = useState<OpportunityId | undefined>(() =>
    companyHandoff.from && day.index.opportunity(companyHandoff.from)
      ? companyHandoff.from
      : undefined,
  );
  useEffect(() => {
    companyHandoff.id = undefined;
    companyHandoff.from = undefined;
  }, []);
  return [id, setId, from] as const;
}

export function Companies({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const companies = ordered(day);
  const [selectedId, setSelectedId] = useCompanySelection(day, companies[0]?.id);
  const selected = day.index.company(selectedId);

  const onListKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const order = companies.map((c) => c.id);
    const at = selectedId ? order.indexOf(selectedId) : -1;
    const target =
      order[Math.min(Math.max(at + (event.key === "ArrowDown" ? 1 : -1), 0), order.length - 1)];
    if (!target) return;
    setSelectedId(target);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-company="${target}"]`)?.focus();
  };

  return (
    <AppFrame active="companies" day={day} navigate={navigate}>
      <div className={k.companies}>
        <nav className={`${s.list} ${s.scroll}`} aria-label="Companies" onKeyDown={onListKey}>
          <div className={s.listHead}>
            <h1 className={s.pageTitle}>Companies</h1>
            <span className={s.dayCount}>{companies.length}</span>
          </div>
          <p className={k.listSummary}>Gathered from your people and opportunities.</p>
          <div className={k.rows}>
            {companies.map((c) => {
              const view = gather(c, day);
              const state = view.ctx ? itemState(view.ctx) : undefined;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-company={c.id}
                  className={k.companyRow}
                  aria-current={c.id === selectedId ? "true" : undefined}
                  onClick={() => setSelectedId(c.id)}
                >
                  <Mark name={c.name} />
                  <span className={s.rowText}>
                    <span className={`${s.pName} ${k.rowName}`}>{c.name}</span>
                    <span className={s.pRole}>
                      {view.active.length} active · {peopleCount(view.people.length)}
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
              );
            })}
          </div>
        </nav>
        <div className={`${s.profile} ${s.scroll}`}>
          {selected ? (
            <CompanyDetail key={selected.id} c={selected} day={day} navigate={navigate} />
          ) : (
            <p className={s.empty}>Choose a company to see what you have there.</p>
          )}
        </div>
      </div>
    </AppFrame>
  );
}

/* ——— Phone ——— */

export function CompaniesMobile({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const companies = ordered(day);
  const [openId, setOpenId, from] = useCompanySelection(day, undefined);
  const [sheet, setSheet] = useState<Person | null>(null);
  const open = day.index.company(openId);
  const overlay = sheet && (
    <PersonSheet key={sheet.id} person={sheet} day={day} onClose={() => setSheet(null)} />
  );

  if (open) {
    const view = gather(open, day);
    const facts = day.index.factsAbout({ type: "company", id: open.id });
    const pursued = [...view.active, ...view.opportunities.filter((o) => o.status === "closed")];
    return (
      <MobileShell
        key={open.id}
        day={day}
        navigate={navigate}
        title={open.name}
        subtitle={[open.sector, open.location].filter(Boolean).join(" · ")}
        leading={<Mark name={open.name} size={48} />}
        active={from ? "opportunities" : undefined}
        back={
          from
            ? { label: "Pursuing", onClick: () => goToOpportunity(navigate, from) }
            : { label: "Companies", onClick: () => setOpenId(undefined) }
        }
        detail
        overlay={overlay}
      >
        <section className={k.mFirst} aria-labelledby="m-company-why">
          <div className={k.mCard}>
            <h2 id="m-company-why" className={s.whyLabel}>
              <Icon.Compass size={14} weight={2} />
              Why {open.name} matters
            </h2>
            <p className={k.mWhyText}>{whyLine(view, day)}</p>
            <p className={k.derived}>From what you&apos;re pursuing and who you know there.</p>
          </div>
        </section>

        {pursued.length > 0 && (
          <section className={s.mSection} aria-labelledby="m-company-pursuing">
            <div className={s.mSectionHead}>
              <h2 id="m-company-pursuing" className={s.mSectionTitle}>
                Pursuing here
              </h2>
              <span className={s.dayCount}>{view.active.length}</span>
            </div>
            <ul className={s.mList}>
              {pursued.map((o) => {
                const deadline = liveDeadline(o, day.today);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`${s.row} ${k.mOppRow}`}
                      onClick={() => goToOpportunity(navigate, o.id)}
                    >
                      {deadline ? (
                        <Tile small date={deadline} tone={deadlineTone(deadline, day.today)} />
                      ) : (
                        <span aria-hidden="true" />
                      )}
                      <span className={s.rowText}>
                        <span className={s.rowTitle}>{o.title}</span>
                        <span className={s.rowSub}>
                          {o.status === "closed" && o.closedReason
                            ? `Closed · ${CLOSED_LABEL[o.closedReason]}`
                            : STAGE_LABEL[o.status]}
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

        {view.people.length > 0 && (
          <section className={s.mSection} aria-labelledby="m-company-people">
            <div className={s.mSectionHead}>
              <h2 id="m-company-people" className={s.mSectionTitle}>
                Who you know here
              </h2>
              <span className={s.dayCount}>{view.people.length}</span>
            </div>
            <ul className={s.mList}>
              {view.people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`${s.row} ${k.mPersonRow}`}
                    onClick={() => setSheet(p)}
                  >
                    <Avatar name={p.name} size={38} />
                    <span className={s.rowText}>
                      <span className={s.rowTitle}>{p.name}</span>
                      <span className={s.rowSub}>
                        {p.role ? `${p.role} · ` : ""}
                        {OUTREACH_LABEL[day.outreachOf(p.id)]}
                      </span>
                    </span>
                    <Icon.ChevronRight size={18} weight={2} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={s.mSection} aria-labelledby="m-company-history">
          <div className={s.mSectionHead}>
            <h2 id="m-company-history" className={s.mSectionTitle}>
              Latest
            </h2>
          </div>
          <div className={k.mCard}>
            <Activity
              day={day}
              interactions={view.interactions}
              drafts={view.drafts}
              empty="Nothing has happened here yet."
              initial={2}
              dense
            />
          </div>
        </section>

        {(open.notes || facts.length > 0) && (
          <section className={s.mSection} aria-labelledby="m-company-know">
            <div className={s.mSectionHead}>
              <h2 id="m-company-know" className={s.mSectionTitle}>
                What you know
              </h2>
            </div>
            {open.notes && <p className={s.note}>{open.notes}</p>}
            {facts.length > 0 && (
              <div className={`${k.mCard} ${k.mGap}`}>
                <FactList facts={facts} />
              </div>
            )}
          </section>
        )}
      </MobileShell>
    );
  }

  return (
    <MobileShell
      key="list"
      day={day}
      navigate={navigate}
      title="Companies"
      subtitle="Gathered from your people and opportunities"
      overlay={overlay}
    >
      <section className={k.mFirst} aria-label="Companies">
        <ul className={s.mList}>
          {companies.map((c) => {
            const view = gather(c, day);
            const state = view.ctx ? itemState(view.ctx) : undefined;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`${s.row} ${k.mCompanyRow}`}
                  onClick={() => setOpenId(c.id)}
                >
                  <Mark name={c.name} size={38} />
                  <span className={s.rowText}>
                    <span className={s.rowTitle}>{c.name}</span>
                    <span className={s.rowSub}>
                      {view.active.length} active · {peopleCount(view.people.length)}
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
      </section>
    </MobileShell>
  );
}
