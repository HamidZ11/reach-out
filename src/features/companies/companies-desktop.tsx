"use client";

import Link from "next/link";
import { shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { Opportunity } from "@/domain/opportunity";
import { FactList } from "@/features/people/knowledge";
import pp from "@/features/people/people.module.css";
import { Activity } from "@/features/pursuing/activity";
import { PersonLine } from "@/features/pursuing/pursuing-desktop";
import pu from "@/features/pursuing/pursuing.module.css";
import { itemState, peopleCount, rowState, TYPE_LABEL } from "@/features/pursuing/wording";
import { opportunityHref } from "@/features/sections";
import { DateTile, deadlineTone, liveDeadline } from "@/features/today/date-tile";
import t from "@/features/today/today.module.css";
import { STAGE_LABEL } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import type { CompanyView } from "./aggregate";
import { standingParts, whyLine } from "./aggregate";
import k from "./companies.module.css";
import { Mark } from "./mark";
import type { CompanySelection } from "./selection";

/* ——— What you're pursuing there ——— */

function PursuitLine({ o, day }: { o: Opportunity; day: WorkspaceState }) {
  const deadline = liveDeadline(o, day.today);
  const state = rowState(o, day);
  return (
    <Link
      href={opportunityHref(o.id)}
      className={k.pursuit}
      data-closed={o.status === "closed" || undefined}
    >
      {deadline ? (
        <DateTile small date={deadline} tone={deadlineTone(deadline, day.today)} />
      ) : (
        <span aria-hidden="true" />
      )}
      <span className={t.rowText}>
        <span className={`${k.pursuitTitle} ${t.oppName}`}>{o.title}</span>
        <span className={t.rowSub}>
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
        <span className={pp.rowState} data-tone={state.tone}>
          {state.tone && <span className={t.dot} data-tone={state.tone} aria-hidden="true" />}
          {state.text}
        </span>
      ) : (
        <span />
      )}
    </Link>
  );
}

/* ——— The company ——— */

function CompanyDetail({ view, day }: { view: CompanyView; day: WorkspaceState }) {
  const c = view.company;
  const facts = day.index.factsAbout({ type: "company", id: c.id });
  const moments = view.interactions.length;

  return (
    <div className={pp.profileInner}>
      <header className={k.companyHead}>
        <Mark name={c.name} size={64} />
        <div>
          <h2 className={pp.personName}>{c.name}</h2>
          <p className={pp.personRole}>{[c.sector, c.location].filter(Boolean).join(" · ")}</p>
          <p className={t.standing}>
            {standingParts(view, day).map((part) => (
              <span key={part}>{part}</span>
            ))}
          </p>
        </div>
        {c.website && (
          <a
            className={t.iconLink}
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
        <h3 id="company-why" className={t.whyLabel}>
          <Icon.Compass size={15} weight={2} />
          Why {c.name} matters
        </h3>
        <p className={k.companyWhyText}>{whyLine(view, day)}</p>
        <p className={k.derived}>From what you&apos;re pursuing and who you know there.</p>
      </section>

      <section className={pu.block} aria-labelledby="company-pursuing">
        <h3 id="company-pursuing" className={t.h3}>
          What you&apos;re pursuing here <span>{view.active.length} active</span>
        </h3>
        {view.pursued.length > 0 ? (
          <div className={k.pursuits}>
            {view.pursued.map((o) => (
              <PursuitLine key={o.id} o={o} day={day} />
            ))}
          </div>
        ) : (
          <p className={pp.muted}>Nothing yet.</p>
        )}
      </section>

      <section className={pu.block} aria-labelledby="company-people">
        <h3 id="company-people" className={t.h3}>
          Who you know here <span>{peopleCount(view.people.length)}</span>
        </h3>
        {view.people.length > 0 ? (
          <div className={pu.peopleList}>
            {view.people.map((p) => (
              <PersonLine key={p.id} person={p} day={day} />
            ))}
          </div>
        ) : (
          <p className={pp.muted}>No one yet.</p>
        )}
      </section>

      <div className={pp.body}>
        <section aria-labelledby="company-history">
          <h3 id="company-history" className={t.h3}>
            What&apos;s happened <span>{moments === 1 ? "1 moment" : `${moments} moments`}</span>
          </h3>
          <Activity
            day={day}
            interactions={view.interactions}
            drafts={view.drafts}
            empty="Nothing has happened here yet."
          />
        </section>
        <aside className={pp.side} aria-label={`What you know about ${c.name}`}>
          <section className={pp.sideBlock} aria-labelledby="company-notes">
            <h3 id="company-notes" className={t.h3}>
              Your notes <span>in your words</span>
            </h3>
            {c.notes ? (
              <p className={pp.note}>{c.notes}</p>
            ) : (
              <p className={pp.muted}>Nothing written yet.</p>
            )}
          </section>
          <section className={pp.sideBlock} aria-labelledby="company-facts">
            <h3 id="company-facts" className={t.h3}>
              What you know <span>{facts.length} sourced</span>
            </h3>
            {facts.length > 0 ? (
              <FactList facts={facts} />
            ) : (
              <p className={pp.muted}>No sourced facts yet.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * Desktop Companies: every company you have something at, beside the
 * selected one. Derived and light — the list is plain buttons in reading
 * order (Tab, then Enter or Space), with no single-key shortcuts.
 */
export function CompaniesDesktop({
  day,
  ordered,
  selection,
}: {
  day: WorkspaceState;
  ordered: CompanyView[];
  selection: CompanySelection;
}) {
  const { selectedId } = selection;
  const selected = ordered.find((v) => v.company.id === selectedId);

  return (
    <div className={k.companies}>
      <nav className={`${pp.list} ${t.scroll}`} aria-label="Companies">
        <div className={pp.listHead}>
          <h1 className={t.pageTitle}>Companies</h1>
          <span className={t.dayCount}>{ordered.length}</span>
        </div>
        <p className={pu.listSummary}>Gathered from your people and opportunities.</p>
        <div className={pu.rows}>
          {ordered.map((view) => {
            const c = view.company;
            const state = view.ctx ? itemState(view.ctx) : undefined;
            return (
              <button
                key={c.id}
                type="button"
                className={k.companyRow}
                aria-current={c.id === selectedId ? "true" : undefined}
                onClick={() => selection.select(c.id)}
              >
                <Mark name={c.name} />
                <span className={t.rowText}>
                  <span className={`${pp.pName} ${k.rowName}`}>{c.name}</span>
                  <span className={pp.pRole}>
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
            );
          })}
        </div>
      </nav>
      <div className={`${pp.profile} ${t.scroll}`}>
        {selected ? (
          <CompanyDetail key={selected.company.id} view={selected} day={day} />
        ) : (
          <p className={pp.empty}>Choose a company to see what you have there.</p>
        )}
      </div>
    </div>
  );
}
