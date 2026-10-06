"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import * as Icon from "@/components/icons";
import type { CompanyId } from "@/domain/ids";
import type { Opportunity } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import { FactList } from "@/features/people/knowledge";
import { SettingsLink } from "@/features/people/people-phone";
import pp from "@/features/people/people.module.css";
import { Activity } from "@/features/pursuing/activity";
import pu from "@/features/pursuing/pursuing.module.css";
import { CLOSED_LABEL, itemState, peopleCount } from "@/features/pursuing/wording";
import { opportunityHref } from "@/features/sections";
import { DateTile, deadlineTone, liveDeadline } from "@/features/today/date-tile";
import { PersonSheet } from "@/features/today/person";
import t from "@/features/today/today.module.css";
import { OUTREACH_LABEL, STAGE_LABEL } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import type { CompanyView } from "./aggregate";
import { whyLine } from "./aggregate";
import k from "./companies.module.css";
import { Mark } from "./mark";
import type { CompanySelection } from "./selection";

/**
 * Companies on a phone: contextual, never a tab. Opened from an opportunity,
 * Back returns to that opportunity (and the bar keeps Pursuing marked);
 * otherwise it is the list, then one company at a time.
 */

function CompanyPage({
  view,
  day,
  onPerson,
}: {
  view: CompanyView;
  day: WorkspaceState;
  onPerson: (person: Person) => void;
}) {
  const c = view.company;
  const facts = day.index.factsAbout({ type: "company", id: c.id });

  return (
    <>
      <section className={pu.mFirst} aria-labelledby="m-company-why">
        <div className={pp.mCard}>
          <h2 id="m-company-why" className={t.whyLabel}>
            <Icon.Compass size={14} weight={2} />
            Why {c.name} matters
          </h2>
          <p className={k.mWhyText}>{whyLine(view, day)}</p>
          <p className={k.derived}>From what you&apos;re pursuing and who you know there.</p>
        </div>
      </section>

      {view.pursued.length > 0 && (
        <section className={t.mSection} aria-labelledby="m-company-pursuing">
          <div className={t.mSectionHead}>
            <h2 id="m-company-pursuing" className={t.mSectionTitle}>
              Pursuing here
            </h2>
            <span className={t.dayCount}>{view.active.length}</span>
          </div>
          <ul className={t.mList}>
            {view.pursued.map((o) => {
              const deadline = liveDeadline(o, day.today);
              return (
                <li key={o.id}>
                  <Link href={opportunityHref(o.id)} className={`${t.row} ${pp.mOppRow}`}>
                    {deadline ? (
                      <DateTile small date={deadline} tone={deadlineTone(deadline, day.today)} />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span className={t.rowText}>
                      <span className={t.rowTitle}>{o.title}</span>
                      <span className={t.rowSub}>
                        {o.status === "closed" && o.closedReason
                          ? `Closed · ${CLOSED_LABEL[o.closedReason]}`
                          : STAGE_LABEL[o.status]}
                      </span>
                    </span>
                    <Icon.ChevronRight size={18} weight={2} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {view.people.length > 0 && (
        <section className={t.mSection} aria-labelledby="m-company-people">
          <div className={t.mSectionHead}>
            <h2 id="m-company-people" className={t.mSectionTitle}>
              Who you know here
            </h2>
            <span className={t.dayCount}>{view.people.length}</span>
          </div>
          <ul className={t.mList}>
            {view.people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`${t.row} ${pu.mPersonRow}`}
                  onClick={() => onPerson(p)}
                >
                  <Avatar name={p.name} size={38} />
                  <span className={t.rowText}>
                    <span className={t.rowTitle}>{p.name}</span>
                    <span className={t.rowSub}>
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

      <section className={t.mSection} aria-labelledby="m-company-history">
        <div className={t.mSectionHead}>
          <h2 id="m-company-history" className={t.mSectionTitle}>
            Latest
          </h2>
        </div>
        <div className={pp.mCard}>
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

      {(c.notes || facts.length > 0) && (
        <section className={t.mSection} aria-labelledby="m-company-know">
          <div className={t.mSectionHead}>
            <h2 id="m-company-know" className={t.mSectionTitle}>
              What you know
            </h2>
          </div>
          {c.notes && <p className={pp.note}>{c.notes}</p>}
          {facts.length > 0 && (
            <div className={`${pp.mCard} ${k.mGap}`}>
              <FactList facts={facts} />
            </div>
          )}
        </section>
      )}
    </>
  );
}

/** One company, as its own page under Back (to the opportunity it came from, or to Companies). */
function CompanyScreen({
  view,
  day,
  from,
  focusOnOpen,
  onBack,
}: {
  view: CompanyView;
  day: WorkspaceState;
  /** The opportunity this was opened from, if any: Back returns there. */
  from?: Opportunity;
  /** Opened from the list: focus moves to the new page's heading. Not on a fresh load. */
  focusOnOpen: boolean;
  onBack: () => void;
}) {
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [sheet, setSheet] = useState<Person | null>(null);
  const c = view.company;

  // A new page starts at its top.
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
    if (focusOnOpen) heading.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  return (
    <>
      <div ref={top} className={t.mTop}>
        {from ? (
          <Link href={opportunityHref(from.id)} className={pp.mBack} aria-label="Back to Pursuing">
            <Icon.ArrowLeft size={18} weight={2} />
            Pursuing
          </Link>
        ) : (
          <button
            type="button"
            className={pp.mBack}
            aria-label="Back to Companies"
            onClick={onBack}
          >
            <Icon.ArrowLeft size={18} weight={2} />
            Companies
          </button>
        )}
        <SettingsLink name={day.user.name} />
      </div>
      <header className={`${t.mHeading} ${pp.mHeadingLead}`}>
        <Mark name={c.name} size={48} />
        <div className={pp.mHeadingText}>
          <h1 ref={heading} tabIndex={-1} className={pp.mDetailTitle}>
            {c.name}
          </h1>
          <span className={t.mDate}>{[c.sector, c.location].filter(Boolean).join(" · ")}</span>
        </div>
      </header>
      <div className={t.mBody}>
        <CompanyPage view={view} day={day} onPerson={setSheet} />
      </div>
      {sheet && (
        <PersonSheet key={sheet.id} person={sheet} day={day} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

export function CompaniesPhone({
  day,
  ordered,
  selection,
}: {
  day: WorkspaceState;
  ordered: CompanyView[];
  selection: CompanySelection;
}) {
  const list = useRef<HTMLDivElement>(null);
  const lastOpen = useRef<CompanyId | undefined>(undefined);
  const openId = selection.requested?.id;
  const open = ordered.find((v) => v.company.id === openId);

  // Back on the list: return to the company you had open, so you keep your place.
  useEffect(() => {
    if (openId) {
      lastOpen.current = openId;
      return;
    }
    const row = list.current?.querySelector<HTMLElement>(`[data-company="${lastOpen.current}"]`);
    lastOpen.current = undefined;
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    if (!document.activeElement || document.activeElement === document.body) {
      row.focus({ preventScroll: true });
    }
  }, [openId]);

  if (open) {
    return (
      <CompanyScreen
        key={open.company.id}
        view={open}
        day={day}
        from={selection.cameFrom}
        focusOnOpen={selection.openedHere}
        onBack={selection.close}
      />
    );
  }

  return (
    <div ref={list}>
      <div className={t.mTop}>
        <span className={t.mMark} aria-hidden="true">
          r
        </span>
        <SettingsLink name={day.user.name} />
      </div>
      <header className={t.mHeading}>
        <div className={pp.mHeadingText}>
          <h1 className={t.mTitle}>Companies</h1>
          <span className={t.mDate}>Gathered from your people and opportunities</span>
        </div>
      </header>
      <div className={t.mBody}>
        <section className={pu.mFirst} aria-label="Companies">
          <ul className={t.mList}>
            {ordered.map((view) => {
              const c = view.company;
              const state = view.ctx ? itemState(view.ctx) : undefined;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    data-company={c.id}
                    className={`${t.row} ${k.mCompanyRow}`}
                    onClick={() => selection.open(c.id)}
                  >
                    <Mark name={c.name} size={38} />
                    <span className={t.rowText}>
                      <span className={t.rowTitle}>{c.name}</span>
                      <span className={t.rowSub}>
                        {view.active.length} active · {peopleCount(view.people.length)}
                      </span>
                    </span>
                    {state ? (
                      <span className={pp.rowState} data-tone={state.tone}>
                        {state.tone && (
                          <span className={t.dot} data-tone={state.tone} aria-hidden="true" />
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
      </div>
    </div>
  );
}
