"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { dayOf, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { OpportunityId } from "@/domain/ids";
import type { Opportunity } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import { SettingsLink } from "@/features/people/people-phone";
import pp from "@/features/people/people.module.css";
import { companyHref } from "@/features/sections";
import { DateTile, deadlineTone, liveDeadline, tileFor } from "@/features/today/date-tile";
import type { Announce, Announcer } from "@/features/today/item-actions";
import { ActionButton, thumbLabel, useItemActions } from "@/features/today/item-actions";
import { PersonSheet, Status } from "@/features/today/person";
import t from "@/features/today/today.module.css";
import { headline, stableKey } from "@/features/today/wording";
import type { ItemContext } from "@/features/workspace/records";
import { OUTREACH_LABEL, RELATIONSHIP_LABEL } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { Activity } from "./activity";
import type { OpportunityGroup } from "./groups";
import { activityOf, contextFor, openActionsOf } from "./groups";
import k from "./pursuing.module.css";
import type { OpportunitySelection } from "./selection";
import { StageTrack } from "./stage-track";
import { rowMeta, rowState, summary, TYPE_LABEL } from "./wording";

/**
 * Pursuing on a phone: the list, then one opportunity at a time. Desktop's
 * split becomes a flow. The opportunity reads in order of what matters: what
 * happens next, where you are, who you know there, what has happened.
 */

/** Today's verbs as a phone card: one primary action, then what else applies. */
function ActionCard({
  ctx,
  day,
  announce,
}: {
  ctx: ItemContext;
  day: WorkspaceState;
  announce: Announce;
}) {
  const actions = useItemActions(ctx, day, announce);
  const { draft } = ctx;
  return (
    <article className={`${pp.mCard} ${pp.mAction}`} aria-label={headline(ctx)}>
      <div className={t.mHead}>
        {tileFor(ctx, day)}
        <div>
          <h3 className={t.mHeadline}>{headline(ctx)}</h3>
          <Status ctx={ctx} className={t.mStatus} />
        </div>
      </div>
      {draft && actions.mode !== "edit" && (
        <div className={`${t.letter} ${t.mClamp}`}>
          {draft.subject && <span className={t.letterSubject}>{draft.subject}</span>}
          {draft.body}
        </div>
      )}
      {actions.composer}
      <div className={t.mActions}>
        {actions.mode ? (
          <button type="button" className={t.secondary} onClick={actions.close}>
            Hide draft — keeps your text
          </button>
        ) : (
          actions.primary && <ActionButton spec={actions.primary} variant="primary" />
        )}
        {!actions.mode && actions.secondary.length > 0 && (
          <div className={t.mRow}>
            {actions.secondary.slice(0, 2).map((a) => (
              <ActionButton key={a.id} spec={thumbLabel(a)} variant="secondary" />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function OpportunityPage({
  o,
  day,
  announce,
  onPerson,
}: {
  o: Opportunity;
  day: WorkspaceState;
  announce: Announce;
  onPerson: (person: Person) => void;
}) {
  const company = day.index.company(o.companyId);
  const people = day.index.peopleOf(o);
  const ctx = contextFor(o, day);
  const planned = openActionsOf(o, day);
  const { interactions, drafts } = activityOf(o, day);

  return (
    <>
      {o.status !== "closed" && (
        <section className={k.mFirst} aria-labelledby="m-opp-next">
          <h2 id="m-opp-next" className={k.mLabel}>
            What happens next
          </h2>
          {ctx ? (
            <ActionCard key={stableKey(ctx)} ctx={ctx} day={day} announce={announce} />
          ) : planned[0] ? (
            <div className={pp.mCard}>
              <div className={t.mHead}>
                <DateTile date={planned[0].dueOn} tone={undefined} />
                <div>
                  <h3 className={t.mHeadline}>{planned[0].title}</h3>
                  <p className={t.mStatus}>
                    Due {shortDay(planned[0].dueOn)} · appears in Today nearer the time
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className={pp.mQuiet}>Nothing planned yet.</p>
          )}
        </section>
      )}

      <section className={t.mSection} aria-labelledby="m-opp-stage">
        <div className={t.mSectionHead}>
          <h2 id="m-opp-stage" className={t.mSectionTitle}>
            Where you are
          </h2>
        </div>
        <div className={pp.mCard}>
          <StageTrack o={o} compact />
        </div>
      </section>

      <section className={t.mSection} aria-labelledby="m-opp-people">
        <div className={t.mSectionHead}>
          <h2 id="m-opp-people" className={t.mSectionTitle}>
            Who you know there
          </h2>
          <span className={t.dayCount}>{people.length}</span>
        </div>
        {people.length > 0 ? (
          <ul className={t.mList}>
            {people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`${t.row} ${k.mPersonRow}`}
                  onClick={() => onPerson(p)}
                >
                  <Avatar name={p.name} size={38} />
                  <span className={t.rowText}>
                    <span className={t.rowTitle}>{p.name}</span>
                    <span className={t.rowSub}>
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
          <p className={pp.mQuiet}>No one linked yet.</p>
        )}
      </section>

      <section className={t.mSection} aria-labelledby="m-opp-history">
        <div className={t.mSectionHead}>
          <h2 id="m-opp-history" className={t.mSectionTitle}>
            What&apos;s happened
          </h2>
        </div>
        <div className={pp.mCard}>
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
        <section className={t.mSection} aria-labelledby="m-opp-notes">
          <div className={t.mSectionHead}>
            <h2 id="m-opp-notes" className={t.mSectionTitle}>
              Your notes
            </h2>
          </div>
          <p className={pp.note}>{o.notes}</p>
        </section>
      )}

      {company && (
        <section className={t.mSection} aria-label="Company">
          {/* Companies opens from here and can return to this opportunity (DESIGN.md › Navigation). */}
          <Link href={companyHref(company.id, o.id)} className={t.mNext}>
            <span className={k.mMarkCell}>
              <Icon.Building size={20} weight={1.75} />
            </span>
            <span className={t.rowText}>
              <span className={t.mNextTitle}>{company.name}</span>
              <span className={t.rowSub}>Everything you have there</span>
            </span>
            <Icon.ChevronRight size={18} weight={2} />
          </Link>
        </section>
      )}
    </>
  );
}

/** One opportunity, as its own page under "Back to Pursuing". */
function OpportunityView({
  o,
  day,
  announcer,
  focusOnOpen,
  onBack,
}: {
  o: Opportunity;
  day: WorkspaceState;
  announcer: Announcer;
  /** Opened from the list: focus moves to the new page's heading. Not on a fresh load. */
  focusOnOpen: boolean;
  onBack: () => void;
}) {
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [sheet, setSheet] = useState<Person | null>(null);
  const company = day.index.company(o.companyId);
  const deadline = liveDeadline(o, day.today);
  const tone = deadline ? deadlineTone(deadline, day.today) : undefined;

  // A new page starts at its top.
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
    if (focusOnOpen) heading.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  return (
    <>
      <div ref={top} className={t.mTop}>
        <button type="button" className={pp.mBack} aria-label="Back to Pursuing" onClick={onBack}>
          <Icon.ArrowLeft size={18} weight={2} />
          Pursuing
        </button>
        <SettingsLink name={day.user.name} />
      </div>
      <header className={t.mHeading}>
        <div className={pp.mHeadingText}>
          <h1 ref={heading} tabIndex={-1} className={pp.mDetailTitle}>
            {o.title}
          </h1>
          <span className={t.mDate}>
            {[company?.name, o.type ? TYPE_LABEL[o.type] : undefined].filter(Boolean).join(" · ")}
            {deadline && (
              <span className={`${t.tone} ${k.mDeadline}`} data-tone={tone}>
                <span className={t.dot} data-tone={tone} aria-hidden="true" />
                Closes {shortDay(deadline)}
              </span>
            )}
          </span>
        </div>
      </header>
      <div className={t.mBody}>
        <OpportunityPage o={o} day={day} announce={announcer.announce} onPerson={setSheet} />
      </div>
      {announcer.view}
      {sheet && (
        <PersonSheet key={sheet.id} person={sheet} day={day} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

/**
 * Phone Pursuing: the list, then one opportunity at a time. The open
 * opportunity is the one in the URL, so Back, the Pursuing tab and a refresh
 * all behave.
 */
export function PursuingPhone({
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
  const list = useRef<HTMLDivElement>(null);
  const lastOpen = useRef<OpportunityId | undefined>(undefined);
  const open = selection.requested;
  const openId = open?.id;

  // Back on the list (by Back, the browser or the Pursuing tab): return to the
  // opportunity you had open, so you keep your place.
  useEffect(() => {
    if (openId) {
      lastOpen.current = openId;
      return;
    }
    const row = list.current?.querySelector<HTMLElement>(
      `[data-opportunity="${lastOpen.current}"]`,
    );
    lastOpen.current = undefined;
    if (!row) return;
    // A closed opportunity sits in the folded Closed group: unfold it to return there.
    const fold = row.closest("details");
    if (fold && !fold.open) fold.open = true;
    row.scrollIntoView({ block: "center" });
    // Only take focus if it was lost with the page (Back), not from the tab bar.
    if (!document.activeElement || document.activeElement === document.body) {
      row.focus({ preventScroll: true });
    }
  }, [openId]);

  if (open) {
    return (
      <OpportunityView
        key={open.id}
        o={open}
        day={day}
        announcer={announcer}
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
          <h1 className={t.mTitle}>Pursuing</h1>
          <span className={t.mDate}>{summary(day)}</span>
        </div>
      </header>
      <div className={t.mBody}>
        {groups.map((g, i) => {
          const rows = (
            <ul className={t.mList}>
              {g.items.map((o) => {
                const deadline = liveDeadline(o, day.today);
                const state = rowState(o, day);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      data-opportunity={o.id}
                      className={`${t.row} ${k.mOppRow}`}
                      onClick={() => selection.open(o.id)}
                    >
                      {deadline ? (
                        <DateTile small date={deadline} tone={deadlineTone(deadline, day.today)} />
                      ) : (
                        <span aria-hidden="true" />
                      )}
                      <span className={t.rowText}>
                        <span className={t.rowTitle}>{o.title}</span>
                        <span className={t.rowSub}>{rowMeta(o, day)}</span>
                        {/* Outside the truncated line, so it never pushes the row wider. */}
                        {deadline && <span className="sr-only">, closes {shortDay(deadline)}</span>}
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
          );
          return g.key === "closed" ? (
            <details key={g.key} className={t.mSection}>
              <summary className={k.mClosedSummary}>
                {g.label} <span className={t.dayCount}>{g.items.length}</span>
              </summary>
              {rows}
            </details>
          ) : (
            <section
              key={g.key}
              className={i === 0 ? k.mFirst : t.mSection}
              aria-labelledby={`m-group-${g.key}`}
            >
              <div className={t.mSectionHead}>
                <h2 id={`m-group-${g.key}`} className={t.mSectionTitle}>
                  {g.label}
                </h2>
                <span className={t.dayCount}>{g.items.length}</span>
              </div>
              {rows}
            </section>
          );
        })}
      </div>
      {announcer.view}
    </div>
  );
}
