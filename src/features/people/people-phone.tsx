"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { delta, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { PersonId } from "@/domain/ids";
import { isPreApplication } from "@/domain/opportunity";
import type { Opportunity } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import type { CalendarDate } from "@/domain/time";
import { TODAY_RULES } from "@/domain/today";
import { SECTIONS } from "@/features/sections";
import { DateTile, tileFor } from "@/features/today/date-tile";
import type { ActionSpec, Announce, Announcer } from "@/features/today/item-actions";
import { ActionButton, useItemActions } from "@/features/today/item-actions";
import { ContactActions, History, Standing, Status } from "@/features/today/person";
import t from "@/features/today/today.module.css";
import type { Tone } from "@/features/today/wording";
import { headline, personState, stableKey } from "@/features/today/wording";
import type { ItemContext } from "@/features/workspace/records";
import { countWord, firstName, STAGE_LABEL } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { groupsOf } from "./groups";
import { FactList, knowledgeOf, Readings } from "./knowledge";
import p from "./people.module.css";
import type { PersonSelection } from "./selection";

/**
 * People on a phone: the list, then one person at a time. Desktop's two
 * columns become a flow. The person reads in order of what matters: why they
 * matter, what's next, what it's for, what has happened, what you know.
 */

/** Labels that fit two to a thumb-width row, as on Today. */
function thumbLabel(spec: ActionSpec): ActionSpec {
  if (spec.id === "snooze") return { ...spec, label: spec.label.split(" ").slice(0, 3).join(" ") };
  if (spec.id === "open") return { ...spec, label: "Open posting" };
  return spec;
}

/** A deadline is worth a tile only before applying, and only while it's still ahead. */
function liveDeadline(o: Opportunity, today: CalendarDate): CalendarDate | undefined {
  return isPreApplication(o) && o.deadline && o.deadline >= today ? o.deadline : undefined;
}

/** Coloured with the same window Today uses for deadlines. */
function deadlineTone(deadline: CalendarDate, today: CalendarDate): Tone {
  const d = delta(today, deadline);
  return d <= 1 ? "late" : d <= TODAY_RULES.deadlineWindowDays ? "now" : undefined;
}

/** Today's verbs as a compact card: one part of a longer page, still with one clear action. */
function CompactAction({
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
    <article className={`${p.mCard} ${p.mAction} ${p.cCard}`} aria-label={headline(ctx)}>
      <div className={p.cHead}>
        {tileFor(ctx, day, true)}
        <div className={t.rowText}>
          <h3 className={p.cHeadline}>{headline(ctx)}</h3>
          <Status ctx={ctx} className={p.cStatus} />
        </div>
      </div>
      {draft && actions.mode !== "edit" && (
        <div className={`${t.letter} ${t.mClamp} ${p.cLetter}`}>
          {draft.subject && <span className={t.letterSubject}>{draft.subject}</span>}
          {draft.body}
        </div>
      )}
      {actions.composer}
      <div className={p.cActions}>
        {actions.mode ? (
          <button type="button" className={t.secondary} onClick={actions.close}>
            Hide draft — keeps your text
          </button>
        ) : (
          actions.primary && <ActionButton spec={actions.primary} variant="primary" />
        )}
        {!actions.mode && actions.secondary.length > 0 && (
          <div className={p.cRow}>
            {actions.secondary.slice(0, 2).map((a) => (
              <ActionButton key={a.id} spec={thumbLabel(a)} variant="secondary" />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Why they matter, folded to three lines. "Read all" appears only when the
 * text really runs past the fold: measured before paint, and again whenever
 * the width changes (a rotation, a resize, the layout becoming visible).
 */
function WhyStatement({ text }: { text: string }) {
  const statement = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const el = statement.current;
    if (open || !el) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  return (
    <>
      <p
        ref={statement}
        id="m-person-why-text"
        tabIndex={-1}
        className={open ? p.mWhyStatement : `${p.mWhyStatement} ${p.clamp3}`}
      >
        {text}
      </p>
      {!open && clamped && (
        <button
          type="button"
          className={t.mMore}
          aria-expanded="false"
          aria-controls="m-person-why-text"
          onClick={() => {
            setOpen(true);
            // The button goes once the text is open; keep focus on what it opened.
            statement.current?.focus({ preventScroll: true });
          }}
        >
          Read all <Icon.ChevronDown size={14} weight={2} />
        </button>
      )}
    </>
  );
}

/** Folds lower-priority knowledge into one tappable row, opened on request. */
function More({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <details className={p.pMore}>
      <summary className={p.pMoreSummary}>
        <span className={p.pMoreTitle}>{title}</span>
        <span className={p.pMoreNote}>{note}</span>
        <Icon.ChevronDown size={16} weight={2} />
      </summary>
      <div className={p.pMoreBody}>{children}</div>
    </details>
  );
}

function PersonPage({
  person,
  day,
  announce,
}: {
  person: Person;
  day: WorkspaceState;
  announce: Announce;
}) {
  const first = firstName(person.name);
  const ctx = day.contexts.find((c) => c.person?.id === person.id);
  const planned = day.index.openActionsFor(person.id)[0];
  const opportunities = day.index.opportunitiesOf(person.id);
  const moments = day.index.historyOf(person.id).length;
  const { company, personFacts, companyFacts, number, readings } = knowledgeOf(person, day);
  const sourced = personFacts.length + companyFacts.length;
  const why = person.whyRelevant;

  return (
    <>
      <div className={p.mStanding}>
        <Standing person={person} day={day} />
      </div>

      <section className={p.mWhyBlock} aria-labelledby="m-person-why">
        <h2 id="m-person-why" className={t.whyLabel}>
          <Icon.Compass size={14} weight={2} />
          Why {first} matters
        </h2>
        {why ? (
          <WhyStatement text={why} />
        ) : (
          <p className={p.mWhyMissing}>
            Not written yet. One sentence here makes every message to {first} easier.
          </p>
        )}
      </section>

      <section className={p.pSection} aria-labelledby="m-person-next">
        <div className={t.mSectionHead}>
          <h2 id="m-person-next" className={t.mSectionTitle}>
            Next
          </h2>
        </div>
        {ctx ? (
          <CompactAction key={stableKey(ctx)} ctx={ctx} day={day} announce={announce} />
        ) : planned ? (
          <div className={`${p.mCard} ${p.cCard}`}>
            <div className={p.cHead}>
              <DateTile
                small
                date={planned.dueOn}
                tone={planned.dueOn < day.today ? "late" : undefined}
              />
              <div className={t.rowText}>
                <h3 className={p.cHeadline}>{planned.title}</h3>
                <p className={p.cStatus}>
                  Due {shortDay(planned.dueOn)} · appears in Today nearer the time
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className={p.mQuiet}>Nothing planned yet.</p>
        )}
      </section>

      {opportunities.length > 0 && (
        <section className={p.pSection} aria-labelledby="m-person-for">
          <div className={t.mSectionHead}>
            <h2 id="m-person-for" className={t.mSectionTitle}>
              {opportunities.length === 1 ? "For" : "Connected to"}
            </h2>
          </div>
          <ul className={t.mList}>
            {opportunities.map((o) => {
              const deadline = liveDeadline(o, day.today);
              return (
                <li key={o.id}>
                  <Link
                    href={SECTIONS.opportunities.href}
                    className={`${t.row} ${p.mOppRow} ${p.pRow}`}
                  >
                    {deadline ? (
                      <DateTile small date={deadline} tone={deadlineTone(deadline, day.today)} />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span className={t.rowText}>
                      <span className={`${t.rowTitle} ${t.oppName}`}>{o.title}</span>
                      <span className={t.rowSub}>
                        {[day.index.company(o.companyId)?.name, STAGE_LABEL[o.status]]
                          .filter(Boolean)
                          .join(" · ")}
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

      <section className={p.pSection} aria-labelledby="m-person-history">
        <div className={t.mSectionHead}>
          <h2 id="m-person-history" className={t.mSectionTitle}>
            Between you
          </h2>
          <span className={t.dayCount}>
            {moments === 1 ? "1 moment" : `${countWord(moments)} moments`}
          </span>
        </div>
        <div className={`${p.mCard} ${p.pHistory}`}>
          <History person={person} day={day} initial={3} dense />
        </div>
      </section>

      <section className={p.pSection} aria-labelledby="m-person-know">
        <div className={t.mSectionHead}>
          <h2 id="m-person-know" className={t.mSectionTitle}>
            What you know
          </h2>
        </div>
        {person.notes ? (
          <p className={`${p.note} ${p.pNote}`}>
            <span className={p.pNoteLabel}>Your note</span>
            {person.notes}
          </p>
        ) : (
          <p className={p.mQuiet}>No notes yet.</p>
        )}
        <div className={p.pFolds}>
          {sourced > 0 ? (
            <More title="Sourced facts" note={`${sourced} with where they came from`}>
              {personFacts.length > 0 && <FactList facts={personFacts} />}
              {companyFacts.length > 0 && (
                <>
                  <p className={p.subhead}>About {company?.name}</p>
                  <FactList facts={companyFacts} first={personFacts.length + 1} />
                </>
              )}
            </More>
          ) : (
            <p className={p.mQuiet}>No sourced facts yet.</p>
          )}
          {readings.length > 0 && (
            <More title="Suggested angle" note="generated, not fact">
              <Readings readings={readings} number={number} />
            </More>
          )}
        </div>
      </section>
    </>
  );
}

/** Your avatar in the top bar opens Settings, which has no tab of its own. */
function SettingsLink({ name }: { name: string }) {
  return (
    <Link href={SECTIONS.settings.href} className={t.mAvatar} aria-label="Settings">
      <Avatar name={name} size={32} />
    </Link>
  );
}

/** One person, as its own page under "Back to People". */
function PersonView({
  person,
  day,
  announcer,
  focusOnOpen,
  onBack,
}: {
  person: Person;
  day: WorkspaceState;
  announcer: Announcer;
  /** Opened from the list: focus moves to the new page's heading. Not on a fresh load. */
  focusOnOpen: boolean;
  onBack: () => void;
}) {
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const company = day.index.companyOf(person);

  // A new page starts at its top.
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
    if (focusOnOpen) heading.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  return (
    <>
      <div ref={top} className={t.mTop}>
        <button type="button" className={p.mBack} aria-label="Back to People" onClick={onBack}>
          <Icon.ArrowLeft size={18} weight={2} />
          People
        </button>
        <SettingsLink name={day.user.name} />
      </div>
      <header className={`${t.mHeading} ${p.mHeadingLead} ${p.mHeadingTrail} ${p.mHeadingTight}`}>
        <Avatar name={person.name} size={44} />
        <div className={p.mHeadingText}>
          <h1 ref={heading} tabIndex={-1} className={`${p.mDetailTitle} ${p.mTightTitle}`}>
            {person.name}
          </h1>
          <span className={`${t.mDate} ${p.mTightSub}`}>
            {[person.role, company?.name].filter(Boolean).join(" · ")}
          </span>
        </div>
        <span className={p.mContacts}>
          <ContactActions person={person} />
        </span>
      </header>
      <div className={t.mBody}>
        <PersonPage person={person} day={day} announce={announcer.announce} />
      </div>
      {announcer.view}
    </>
  );
}

/**
 * Phone People: the list, then one person at a time. The open person is the
 * one in the URL, so Back, the People tab and a refresh all behave.
 */
export function PeoplePhone({
  day,
  announcer,
  selection,
}: {
  day: WorkspaceState;
  announcer: Announcer;
  selection: PersonSelection;
}) {
  const [query, setQuery] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const lastOpen = useRef<PersonId | undefined>(undefined);
  const open = selection.requested;
  const openId = open?.id;

  // Back on the list (by Back, the browser or the People tab): return to the
  // person you had open, so you keep your place.
  useEffect(() => {
    if (openId) {
      lastOpen.current = openId;
      return;
    }
    const row = list.current?.querySelector<HTMLElement>(`[data-person="${lastOpen.current}"]`);
    lastOpen.current = undefined;
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    // Only take focus if it was lost with the page (Back), not from the tab bar.
    if (!document.activeElement || document.activeElement === document.body) {
      row.focus({ preventScroll: true });
    }
  }, [openId]);

  if (open) {
    return (
      <PersonView
        key={open.id}
        person={open}
        day={day}
        announcer={announcer}
        focusOnOpen={selection.openedHere}
        onBack={selection.close}
      />
    );
  }

  const groups = groupsOf(day, query);
  const waiting = new Set(day.contexts.flatMap((c) => (c.person ? [c.person.id] : []))).size;

  return (
    <div ref={list}>
      <div className={t.mTop}>
        <span className={t.mMark} aria-hidden="true">
          r
        </span>
        <SettingsLink name={day.user.name} />
      </div>
      <header className={t.mHeading}>
        <div className={p.mHeadingText}>
          <h1 className={t.mTitle}>People</h1>
          <span className={t.mDate}>
            {day.records.people.length} people · {countWord(waiting)} need you
          </span>
        </div>
      </header>
      <div className={t.mBody}>
        <label className={p.mSearch}>
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

        {groups.length === 0 && <p className={p.mQuiet}>No one matches “{query}”.</p>}

        {groups.map((g) => (
          <section key={g.key} className={t.mSection} aria-label={g.title}>
            <div className={p.mGroupHead}>
              <h2 className={p.mGroupTitle}>
                {g.key !== "past" && g.key !== "unlinked" && (
                  <Icon.Target size={14} weight={2.25} />
                )}
                {g.title}
              </h2>
              {g.meta && <span className={p.mGroupMeta}>{g.meta}</span>}
            </div>
            <ul className={t.mList}>
              {g.people.map((person) => {
                const state = personState(
                  day.contexts.find((c) => c.person?.id === person.id),
                  person,
                );
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      data-person={person.id}
                      className={`${t.row} ${p.mPeopleRow}`}
                      onClick={() => selection.open(person.id)}
                    >
                      <Avatar name={person.name} size={40} />
                      <span className={t.rowText}>
                        <span className={p.nameLine}>
                          <span className={t.rowTitle}>{person.name}</span>
                          <span className={`${p.rowState} ${p.lineState}`} data-tone={state.tone}>
                            {state.tone && (
                              <span className={t.dot} data-tone={state.tone} aria-hidden="true" />
                            )}
                            {state.text}
                          </span>
                        </span>
                        <span className={t.rowSub}>
                          {[person.role, day.index.companyOf(person)?.name]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {announcer.view}
    </div>
  );
}
