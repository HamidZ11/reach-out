"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/avatar";
import { ago, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { PersonId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import { SettingsLink } from "@/features/people/people-phone";
import pp from "@/features/people/people.module.css";
import { ActionCard } from "@/features/pursuing/pursuing-phone";
import pu from "@/features/pursuing/pursuing.module.css";
import { opportunityHref, personHref } from "@/features/sections";
import { DateTile } from "@/features/today/date-tile";
import type { Announce, Announcer } from "@/features/today/item-actions";
import { History } from "@/features/today/person";
import t from "@/features/today/today.module.css";
import { lastExchange, stableKey } from "@/features/today/wording";
import { firstName } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import k from "./outreach.module.css";
import { Context, StateMark, STATES } from "./parts";
import type { TrackSelection } from "./selection";
import type { Track, Tracks } from "./tracks";
import { trackOf } from "./tracks";
import { lastLine, rowStatus, summary } from "./wording";

/**
 * Outreach on a phone: a list of who needs what, then one person at a time.
 * The open person is the one in the URL, so Back, the Outreach tab and a
 * refresh all behave. Nothing is sent from here.
 */

/** The state of someone who needs nothing from you right now. */
function QuietCard({ person, day }: { person: Person; day: WorkspaceState }) {
  const first = firstName(person.name);
  const state = day.outreachOf(person.id);
  const last = lastExchange(person, day);
  const followUp = day.index.openActionsFor(person.id).find((a) => a.kind === "follow_up");
  const headline =
    state === "closed"
      ? "Outreach closed"
      : state === "sent"
        ? `Waiting to hear from ${first}`
        : state === "replied"
          ? `In conversation with ${first}`
          : `You haven't written to ${first} yet`;
  return (
    <div className={pp.mCard}>
      <h2 className={t.mHeadline}>{headline}</h2>
      <p className={t.mStatus}>
        {state === "closed" && person.outreachClosure
          ? `Closed ${ago(day.index.daysSince(person.outreachClosure.closedAt))}${person.outreachClosure.reason === "no_response" ? " · no response" : ""}`
          : (lastLine(person, day) ?? "Nothing sent yet")}
      </p>
      {last && (
        <div className={k.quote}>
          <p className={t.label}>
            <Icon.ArrowUpRight size={14} weight={2} />
            {last.kind === "message_sent" ? "What you sent" : "Last time"}
          </p>
          <p className={t.cellText}>{last.summary}</p>
        </div>
      )}
      {state === "not_started" && person.whyRelevant && (
        <div className={k.quote}>
          <p className={t.whyLabel}>
            <Icon.Compass size={14} weight={2} />
            Why {first} matters
          </p>
          <p className={k.quoteWhy}>{person.whyRelevant}</p>
        </div>
      )}
      {followUp && (
        <div className={k.mPlanned}>
          <DateTile small date={followUp.dueOn} tone={undefined} />
          <span className={t.rowText}>
            <span className={t.rowTitle}>{followUp.title}</span>
            <span className={t.rowSub}>Planned for {shortDay(followUp.dueOn)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function TrackPage({
  person,
  track,
  day,
  announce,
}: {
  person: Person;
  track?: Track;
  day: WorkspaceState;
  announce: Announce;
}) {
  const opportunity = track?.ctx?.opportunity ?? day.index.opportunitiesOf(person.id)[0];
  const moments = day.index.historyOf(person.id).length;
  return (
    <>
      <section className={pu.mFirst} aria-label="What to do">
        {track?.ctx ? (
          <ActionCard key={stableKey(track.ctx)} ctx={track.ctx} day={day} announce={announce} full>
            <Context ctx={track.ctx} person={person} />
          </ActionCard>
        ) : (
          <QuietCard person={person} day={day} />
        )}
      </section>

      {opportunity && (
        <section className={t.mSection} aria-label="What it's for">
          <Link href={opportunityHref(opportunity.id)} className={t.mNext}>
            <span className={pu.mMarkCell}>
              <Icon.Target size={20} weight={1.75} />
            </span>
            <span className={t.rowText}>
              <span className={`${t.mNextTitle} ${t.oppName}`}>{opportunity.title}</span>
              <span className={t.rowSub}>What this outreach is for</span>
            </span>
            <Icon.ChevronRight size={18} weight={2} />
          </Link>
        </section>
      )}

      <section className={t.mSection} aria-labelledby="m-track-history">
        <div className={t.mSectionHead}>
          <h2 id="m-track-history" className={t.mSectionTitle}>
            Between you
          </h2>
          <span className={t.dayCount}>{moments}</span>
        </div>
        <div className={pp.mCard}>
          <History person={person} day={day} initial={3} dense />
        </div>
      </section>

      <section className={t.mSection} aria-label="More">
        <Link href={personHref(person.id)} className={`${t.secondary} ${k.mWide}`}>
          Everything about {firstName(person.name)}
          <Icon.ArrowRight size={16} weight={2} />
        </Link>
      </section>
    </>
  );
}

/** One person's track, as its own page under "Back to Outreach". */
function TrackView({
  person,
  track,
  day,
  announcer,
  focusOnOpen,
  onBack,
}: {
  person: Person;
  track?: Track;
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
        <button type="button" className={pp.mBack} aria-label="Back to Outreach" onClick={onBack}>
          <Icon.ArrowLeft size={18} weight={2} />
          Outreach
        </button>
        <SettingsLink name={day.user.name} />
      </div>
      <header className={`${t.mHeading} ${pp.mHeadingLead} ${pp.mHeadingTight}`}>
        <Avatar name={person.name} size={44} />
        <div className={pp.mHeadingText}>
          <h1 ref={heading} tabIndex={-1} className={`${pp.mDetailTitle} ${pp.mTightTitle}`}>
            {person.name}
          </h1>
          <span className={`${t.mDate} ${pp.mTightSub}`}>
            {[person.role, company?.name].filter(Boolean).join(" · ")}
          </span>
        </div>
      </header>
      <div className={t.mBody}>
        <TrackPage person={person} track={track} day={day} announce={announcer.announce} />
      </div>
      {announcer.view}
    </>
  );
}

export function OutreachPhone({
  day,
  tracks,
  announcer,
  selection,
}: {
  day: WorkspaceState;
  tracks: Tracks;
  announcer: Announcer;
  selection: TrackSelection;
}) {
  const list = useRef<HTMLDivElement>(null);
  const lastOpen = useRef<PersonId | undefined>(undefined);
  const open = selection.requested;
  const openId = open?.id;
  const firstKey = STATES.find((state) => tracks[state.key].length > 0)?.key;

  // Back on the list (by Back, the browser or the Outreach tab): return to the
  // person you had open, so you keep your place.
  useEffect(() => {
    if (openId) {
      lastOpen.current = openId;
      return;
    }
    const row = list.current?.querySelector<HTMLElement>(`[data-person="${lastOpen.current}"]`);
    lastOpen.current = undefined;
    if (!row) return;
    // Not contacted yet and Closed are folded: unfold the group to return there.
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
      <TrackView
        key={open.id}
        person={open}
        track={trackOf(open, tracks)?.track}
        day={day}
        announcer={announcer}
        focusOnOpen={selection.openedHere}
        onBack={selection.close}
      />
    );
  }

  const rows = (items: Track[]) => (
    <ul className={`${t.mList} ${k.mTrackList}`}>
      {items.map((tr) => {
        const status = rowStatus(tr, day);
        return (
          <li key={tr.person.id}>
            <button
              type="button"
              data-person={tr.person.id}
              className={`${t.row} ${k.mTrackRow}`}
              onClick={() => selection.open(tr.person.id)}
            >
              <Avatar name={tr.person.name} size={36} />
              <span className={k.rowMain}>
                <span className={t.rowText}>
                  <span className={t.rowTitle}>{tr.person.name}</span>
                  <span className={k.mRowStatus} data-tone={status.tone}>
                    {status.tone && (
                      <span className={t.dot} data-tone={status.tone} aria-hidden="true" />
                    )}
                    {status.text}
                  </span>
                </span>
                <Icon.ChevronRight size={18} weight={2} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

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
          <h1 className={t.mTitle}>Outreach</h1>
          <span className={t.mDate}>{summary(tracks)}</span>
        </div>
      </header>
      <div className={t.mBody}>
        {STATES.map((state) => {
          const items = tracks[state.key];
          if (items.length === 0) return null;
          return (
            <section
              key={state.key}
              className={state.key === firstKey ? pu.mFirst : t.mSection}
              aria-labelledby={`m-out-${state.key}`}
            >
              <div className={k.mStateHead}>
                <StateMark tone={state.tone} icon={state.icon} />
                <h2 id={`m-out-${state.key}`} className={t.mSectionTitle}>
                  {state.title}
                </h2>
                <span className={t.dayCount}>{items.length}</span>
              </div>
              {rows(items)}
            </section>
          );
        })}
        {tracks.quiet.length > 0 && (
          <details className={t.mSection}>
            <summary className={pu.mClosedSummary}>
              Not contacted yet <span className={t.dayCount}>{tracks.quiet.length}</span>
            </summary>
            {rows(tracks.quiet)}
          </details>
        )}
        {tracks.closed.length > 0 && (
          <details className={t.mSection}>
            <summary className={pu.mClosedSummary}>
              Closed <span className={t.dayCount}>{tracks.closed.length}</span>
            </summary>
            {rows(tracks.closed)}
          </details>
        )}
        <p className={k.mFootnote}>Reachout never sends anything on its own.</p>
      </div>
      {announcer.view}
    </div>
  );
}
