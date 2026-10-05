"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { ago, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { PersonId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import pu from "@/features/pursuing/pursuing.module.css";
import { opportunityHref, personHref } from "@/features/sections";
import type { Announce, Announcer } from "@/features/today/item-actions";
import { ActionButton, useItemActions } from "@/features/today/item-actions";
import { Status } from "@/features/today/person";
import t from "@/features/today/today.module.css";
import { lastExchange, stableKey } from "@/features/today/wording";
import type { ItemContext } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import k from "./outreach.module.css";
import { Context, StateMark, STATES } from "./parts";
import type { TrackSelection } from "./selection";
import type { Track, TrackKey, Tracks } from "./tracks";
import { lastLine, summary } from "./wording";

/* ——— A track you act on where it sits ——— */

/**
 * Acting can move a track to another group, taking the focused button with
 * it. Focus then follows the person: their name, in the track's new place.
 */
function useRefocus(refocus: boolean) {
  const name = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (refocus && (!document.activeElement || document.activeElement === document.body)) {
      name.current?.focus({ preventScroll: true });
    }
  }, [refocus]);
  return name;
}

function TrackActions({
  ctx,
  person,
  day,
  announce,
  approved,
}: {
  ctx: ItemContext;
  person: Person;
  day: WorkspaceState;
  announce: Announce;
  /** Already approved: the text is settled, so it can fold to a few lines. */
  approved: boolean;
}) {
  const actions = useItemActions(ctx, day, announce);
  const [whole, setWhole] = useState(!approved);
  const { draft, opportunity } = ctx;
  return (
    <div className={k.trackBody}>
      <Context ctx={ctx} person={person} />
      {draft && actions.mode !== "edit" && (
        <>
          <div className={whole ? t.letter : `${t.letter} ${k.folded}`}>
            {draft.subject && <span className={t.letterSubject}>{draft.subject}</span>}
            {draft.body}
          </div>
          {!whole && (
            <button type="button" className={pu.showAll} onClick={() => setWhole(true)}>
              Read the whole message
              <Icon.ChevronDown size={15} weight={2} />
            </button>
          )}
        </>
      )}
      {actions.composer}
      <div className={k.trackFoot}>
        {actions.mode ? (
          <button type="button" className={`${t.text} ${t.small}`} onClick={actions.close}>
            Hide draft — keeps your text
          </button>
        ) : (
          actions.primary && (
            <ActionButton spec={actions.primary} variant="primary" className={t.small} />
          )
        )}
        {!actions.mode &&
          actions.secondary.map((a) => (
            <ActionButton key={a.id} spec={a} variant="secondary" className={t.small} />
          ))}
        {opportunity && (
          <span className={k.trackFor}>
            For{" "}
            <Link href={opportunityHref(opportunity.id)} className={t.oppName}>
              {opportunity.title}
            </Link>
          </span>
        )}
      </div>
    </div>
  );
}

function TrackItem({
  track,
  day,
  announce,
  approved,
  marked,
  refocus,
}: {
  track: Track;
  day: WorkspaceState;
  announce: Announce;
  approved: boolean;
  marked: boolean;
  refocus: boolean;
}) {
  const { person, ctx } = track;
  const company = day.index.companyOf(person);
  const planned = day.index.openActionsFor(person.id)[0];
  const name = useRefocus(refocus);
  return (
    <li className={k.track} data-track={person.id} aria-current={marked ? "true" : undefined}>
      <div className={k.trackHead}>
        <Avatar name={person.name} size={40} />
        <div className={t.rowText}>
          <Link ref={name} href={personHref(person.id)} className={k.trackName}>
            {person.name}
          </Link>
          <span className={k.trackMeta}>
            {[person.role, company?.name].filter(Boolean).join(" · ")}
          </span>
        </div>
        {ctx && <Status ctx={ctx} className={k.trackStatus} />}
      </div>
      {ctx ? (
        <TrackActions
          key={stableKey(ctx)}
          ctx={ctx}
          person={person}
          day={day}
          announce={announce}
          approved={approved}
        />
      ) : (
        planned && (
          <p className={k.trackPlan}>
            {planned.title} · planned for {shortDay(planned.dueOn)}. It appears in Today nearer the
            time.
          </p>
        )
      )}
    </li>
  );
}

/** A person whose outreach is out with them, or quiet: one line each. */
function QuietRow({
  track,
  day,
  marked,
  refocus,
}: {
  track: Track;
  day: WorkspaceState;
  marked: boolean;
  refocus: boolean;
}) {
  const { person } = track;
  const name = useRefocus(refocus);
  const last = lastExchange(person, day);
  const followUp = day.index.openActionsFor(person.id).find((a) => a.kind === "follow_up");
  const subject =
    last && (last.kind === "message_sent" || last.kind === "message_received")
      ? last.subject
      : undefined;
  const state = day.outreachOf(person.id);
  return (
    <li className={k.quietRow} data-track={person.id} aria-current={marked ? "true" : undefined}>
      <Avatar name={person.name} size={32} />
      <span className={t.rowText}>
        <Link ref={name} href={personHref(person.id)} className={k.quietName}>
          {person.name}
        </Link>
        <span className={t.rowSub}>
          {state === "closed"
            ? `Closed ${person.outreachClosure ? ago(day.index.daysSince(person.outreachClosure.closedAt)) : ""}`.trim()
            : last
              ? `${lastLine(person, day) ?? ""} · ${subject ? `“${subject}”` : last.summary}`
              : (person.role ?? "Not contacted yet")}
        </span>
      </span>
      <span className={k.quietWhen}>
        {state === "sent"
          ? followUp
            ? `Follow-up ${shortDay(followUp.dueOn)}`
            : "No follow-up planned"
          : state === "closed" && person.outreachClosure?.reason === "no_response"
            ? "No response"
            : ""}
      </span>
    </li>
  );
}

/* ——— How a message moves ——— */

const PATH: { title: string; rule: string; groups: TrackKey[] }[] = [
  { title: "Draft", rule: "Written by you, waiting for your approval.", groups: ["approve"] },
  { title: "Approved", rule: "Send it yourself, then mark it as sent.", groups: ["send"] },
  { title: "Sent", rule: "Waiting to hear back.", groups: ["waiting"] },
  {
    title: "Replied or follow-up due",
    rule: "Your turn to write.",
    groups: ["write", "conversation"],
  },
  { title: "Closed", rule: "Stopped for now. Anything new reopens it.", groups: ["closed"] },
];

/**
 * Desktop Outreach: every person's correspondence, grouped by where it stands.
 * You act on each track where it sits; "How a message moves" stays beside it.
 * Nothing is sent from Reachout, and there are no single-key shortcuts.
 */
export function OutreachDesktop({
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
  const { announce, view: toast } = announcer;
  const stage = useRef<HTMLDivElement>(null);
  const marked = selection.requested?.id;
  const [closedOpen, setClosedOpen] = useState(false);
  const [actedOn, setActedOn] = useState<PersonId>();
  const announceFor =
    (id: PersonId): Announce =>
    (message) => {
      setActedOn(id);
      announce(message);
    };

  // A link to someone's track: bring it into view, unfolding its group if needed.
  useEffect(() => {
    if (!marked) return;
    const row = stage.current?.querySelector<HTMLElement>(`[data-track="${marked}"]`);
    const fold = row?.closest("details");
    if (fold && !fold.open) fold.open = true;
    row?.scrollIntoView({ block: "center" });
  }, [marked]);

  const jump = (key: TrackKey) => {
    if (key === "closed") setClosedOpen(true);
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      document
        .getElementById(`outreach-${key}`)
        ?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" }),
    );
  };
  // People whose first message is planned sit in To write, but haven't reached the path yet.
  const pathCount = (keys: TrackKey[]) =>
    keys.reduce(
      (n, key) =>
        n +
        tracks[key].filter(
          (tr) => key !== "write" || day.outreachOf(tr.person.id) !== "not_started",
        ).length,
      0,
    );
  const quietRows = (list: Track[]) => (
    <ol className={k.quietList}>
      {list.map((tr) => (
        <QuietRow
          key={tr.person.id}
          track={tr}
          day={day}
          marked={tr.person.id === marked}
          refocus={tr.person.id === actedOn}
        />
      ))}
    </ol>
  );

  return (
    <div className={k.outreach}>
      <div ref={stage} className={`${t.stage} ${t.scroll}`}>
        <header className={t.pageHead}>
          <h1 className={t.pageTitle}>Outreach</h1>
          <span className={t.pageSub}>{summary(tracks)}</span>
        </header>

        {STATES.map((state) => {
          const list = tracks[state.key];
          if (list.length === 0) return null;
          const quiet = state.key === "waiting" || state.key === "conversation";
          return (
            <section
              key={state.key}
              id={`outreach-${state.key}`}
              className={k.section}
              aria-labelledby={`outreach-${state.key}-title`}
            >
              <header className={k.sectionHead}>
                <StateMark tone={state.tone} icon={state.icon} />
                <div>
                  <h2 id={`outreach-${state.key}-title`} className={k.sectionTitle}>
                    {state.title} <span>{list.length}</span>
                  </h2>
                  <p className={k.sectionHint}>{state.hint}</p>
                </div>
              </header>
              {quiet ? (
                quietRows(list)
              ) : (
                <ol className={k.tracks}>
                  {list.map((tr) => (
                    <TrackItem
                      key={tr.person.id}
                      track={tr}
                      day={day}
                      announce={announceFor(tr.person.id)}
                      approved={state.key === "send"}
                      marked={tr.person.id === marked}
                      refocus={tr.person.id === actedOn}
                    />
                  ))}
                </ol>
              )}
            </section>
          );
        })}

        {tracks.quiet.length > 0 && (
          <details className={k.more}>
            <summary className={k.moreSummary}>
              Not contacted yet <span>{tracks.quiet.length}</span>
            </summary>
            {quietRows(tracks.quiet)}
          </details>
        )}
        {tracks.closed.length > 0 && (
          <details
            id="outreach-closed"
            className={k.more}
            open={closedOpen}
            onToggle={(e) => setClosedOpen(e.currentTarget.open)}
          >
            <summary className={k.moreSummary}>
              Closed <span>{tracks.closed.length}</span>
            </summary>
            {quietRows(tracks.closed)}
          </details>
        )}
        {toast}
      </div>

      <aside className={`${t.day} ${t.scroll}`} aria-labelledby="outreach-path">
        <div className={t.dayHead}>
          <h2 id="outreach-path" className={t.dayTitle}>
            How a message moves
          </h2>
        </div>
        <ol className={k.path}>
          {PATH.map((step) => {
            const count = pathCount(step.groups);
            const target = step.groups.find((g) => tracks[g].length > 0);
            return (
              <li key={step.title} className={k.pathStep} data-empty={count === 0 || undefined}>
                <button
                  type="button"
                  className={k.pathButton}
                  disabled={!target}
                  onClick={() => target && jump(target)}
                >
                  <span className={k.pathNode}>{count}</span>
                  <span className={t.rowText}>
                    <span className={k.pathTitle}>{step.title}</span>
                    <span className={k.pathRule}>{step.rule}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className={t.later}>
          Reachout never sends anything on its own. Every message is approved, sent and marked as
          sent by you.
        </p>
      </aside>
    </div>
  );
}
