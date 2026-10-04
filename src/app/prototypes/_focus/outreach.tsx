"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { PersonId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import type { TodayItem } from "@/domain/today";
import { ago, shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { ItemContext } from "../_shared/snapshot";
import { capitalise, firstName, sentVerb } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import type { Announce } from "./actions";
import { ActionButton, useAnnouncer, useItemActions } from "./actions";
import s from "./focus.module.css";
import { goToOpportunity, goToPerson, MobileAction } from "./kit";
import type { Tone } from "./parts";
import { AppFrame, Avatar, lastExchange, Status, statusFor, Tile } from "./parts";
import { History } from "./people";
import { MobileShell } from "./shell";
import k from "./surfaces.module.css";

/**
 * Outreach: every person's correspondence, grouped by where it stands
 * (draft → approved → sent → replied or follow-up due → closed). One track per
 * person (D-014). You act on each item where it sits; nothing is sent for you.
 */

type GroupKey = "write" | "approve" | "send" | "conversation" | "waiting" | "quiet" | "closed";
type Track = { person: Person; ctx?: ItemContext; rank: number };

/**
 * Each state has a mark drawn like the history's nodes: needs you (marigold),
 * in conversation or ready (green), out with them (neutral). Icon and words
 * always come with the colour.
 */
const SECTIONS: { key: GroupKey; title: string; hint: string; tone: Tone; icon: ReactNode }[] = [
  {
    key: "write",
    title: "To write",
    hint: "Replies to answer, follow-ups that are due, and first messages you planned.",
    tone: "now",
    icon: <Icon.Pen size={14} weight={2} />,
  },
  {
    key: "approve",
    title: "Waiting for your approval",
    hint: "Nothing is sent until you approve it.",
    tone: "now",
    icon: <Icon.Check size={14} weight={2.2} />,
  },
  {
    key: "send",
    title: "Approved, ready to send",
    hint: "Send it from your own email or LinkedIn, then mark it as sent.",
    tone: "good",
    icon: <Icon.Send size={14} weight={2} />,
  },
  {
    key: "conversation",
    title: "In conversation",
    hint: "You've spoken recently and nothing needs writing yet.",
    tone: "good",
    icon: <Icon.Chat size={14} weight={2} />,
  },
  {
    key: "waiting",
    title: "Sent, waiting to hear",
    hint: "When a follow-up falls due, it moves up to To write.",
    tone: undefined,
    icon: <Icon.Clock size={14} weight={2} />,
  },
];

function StateMark({ tone, icon }: { tone: Tone; icon: ReactNode }) {
  return (
    <span className={k.stateMark} data-tone={tone} aria-hidden="true">
      {icon}
    </span>
  );
}

/** Where each person's outreach stands, from the derived outreach state. */
function tracksOf(day: Day): Record<GroupKey, Track[]> {
  const groups: Record<GroupKey, Track[]> = {
    write: [],
    approve: [],
    send: [],
    conversation: [],
    waiting: [],
    quiet: [],
    closed: [],
  };
  for (const person of day.records.people) {
    const mine = day.contexts.filter((c) => c.person?.id === person.id);
    const pick = (...kinds: TodayItem["kind"][]) => mine.find((c) => kinds.includes(c.item.kind));
    const track = (ctx?: ItemContext): Track => ({
      person,
      ctx,
      rank: ctx ? day.contexts.indexOf(ctx) : Number.MAX_SAFE_INTEGER,
    });
    switch (day.outreachOf(person.id)) {
      case "replied":
        if (lastExchange(person, day)?.kind === "message_received") {
          groups.write.push(track(pick("reply_awaiting_response") ?? mine[0]));
        } else {
          groups.conversation.push(track(mine[0]));
        }
        break;
      case "follow_up_due":
        groups.write.push(track(pick("overdue_follow_up", "upcoming_action")));
        break;
      case "draft": {
        const awaiting = day.index
          .pendingDraftsFor(person.id)
          .some((d) => d.status === "awaiting_approval");
        if (awaiting) groups.approve.push(track(pick("draft_awaiting_approval")));
        else groups.send.push(track(pick("draft_ready_to_send")));
        break;
      }
      case "sent":
        groups.waiting.push(track());
        break;
      case "not_started": {
        const planned = day.index.openActionsFor(person.id).some((a) => a.kind === "reach_out");
        if (planned) groups.write.push(track(pick("upcoming_action")));
        else groups.quiet.push(track());
        break;
      }
      case "closed":
        groups.closed.push(track());
        break;
    }
  }
  groups.write.sort((a, b) => a.rank - b.rank);
  groups.waiting.sort((a, b) =>
    (lastExchange(b.person, day)?.occurredAt ?? "").localeCompare(
      lastExchange(a.person, day)?.occurredAt ?? "",
    ),
  );
  return groups;
}

/** "2 to write · 1 to approve · 1 to send" */
function summary(groups: Record<GroupKey, Track[]>): string {
  const parts = [
    groups.write.length && `${groups.write.length} to write`,
    groups.approve.length && `${groups.approve.length} to approve`,
    groups.send.length && `${groups.send.length} to send`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing is waiting on you";
}

/** The last exchange in a few words: "Emailed 3 days ago", "Met yesterday". */
function lastLine(person: Person, day: Day): string | undefined {
  const last = lastExchange(person, day);
  if (!last) return undefined;
  const when = ago(day.index.daysSince(last.occurredAt));
  if (last.kind === "meeting") return `Met ${when}`;
  if (last.kind === "message_received") return `${firstName(person.name)} replied ${when}`;
  return `${capitalise(sentVerb(last))} ${when}`;
}

/** What the item is responding to, shown before you act on it. */
function Context({ ctx, person }: { ctx: ItemContext; person: Person }) {
  const { item, message, action } = ctx;
  const first = firstName(person.name);
  const quote = (label: string, icon: ReactNode, text: string, subject?: string) => (
    <div className={k.quote}>
      <p className={s.label}>
        {icon}
        {label}
      </p>
      {subject && <p className={k.quoteSubject}>“{subject}”</p>}
      <p className={s.cellText}>{text}</p>
    </div>
  );
  const subject =
    message && (message.kind === "message_sent" || message.kind === "message_received")
      ? message.subject
      : undefined;
  if (item.kind === "reply_awaiting_response" && message) {
    return quote(`${first}'s reply`, <Icon.Chat size={14} weight={2} />, message.summary, subject);
  }
  if (message && (item.kind === "overdue_follow_up" || action?.kind === "follow_up")) {
    return quote(
      "What you sent",
      <Icon.ArrowUpRight size={14} weight={2} />,
      message.summary,
      subject,
    );
  }
  if (item.kind === "upcoming_action" && (person.whyRelevant || person.notes)) {
    return (
      <div className={k.quote}>
        <p className={s.whyLabel}>
          <Icon.Compass size={14} weight={2} />
          {person.whyRelevant ? `Why ${first} matters` : "Your note"}
        </p>
        <p className={k.quoteWhy}>{person.whyRelevant ?? person.notes}</p>
      </div>
    );
  }
  return null;
}

/* ——— Desktop ——— */

function TrackActions({
  ctx,
  person,
  day,
  announce,
  approved,
}: {
  ctx: ItemContext;
  person: Person;
  day: Day;
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
          <div className={whole ? s.letter : `${s.letter} ${k.folded}`}>
            {draft.subject && <span className={s.letterSubject}>{draft.subject}</span>}
            {draft.body}
          </div>
          {!whole && (
            <button type="button" className={k.showAll} onClick={() => setWhole(true)}>
              Read the whole message
              <Icon.ChevronDown size={15} weight={2} />
            </button>
          )}
        </>
      )}
      {actions.composer}
      <div className={k.trackFoot}>
        {actions.mode ? (
          <button type="button" className={`${s.text} ${s.small}`} onClick={actions.close}>
            Hide draft — keeps your text
          </button>
        ) : (
          actions.primary && (
            <ActionButton spec={actions.primary} variant="primary" className={s.small} />
          )
        )}
        {!actions.mode &&
          actions.secondary.map((a) => (
            <ActionButton key={a.id} spec={a} variant="secondary" className={s.small} />
          ))}
        {opportunity && (
          <span className={k.trackFor}>
            For <span className={s.oppName}>{opportunity.title}</span>
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
  onPerson,
  approved,
}: {
  track: Track;
  day: Day;
  announce: Announce;
  onPerson: () => void;
  approved: boolean;
}) {
  const { person, ctx } = track;
  const company = day.index.companyOf(person);
  const planned = day.index.openActionsFor(person.id)[0];
  return (
    <li className={k.track}>
      <div className={k.trackHead}>
        <Avatar name={person.name} size={40} />
        <div className={s.rowText}>
          <button type="button" className={k.trackName} onClick={onPerson}>
            {person.name}
          </button>
          <span className={k.trackMeta}>
            {[person.role, company?.name].filter(Boolean).join(" · ")}
          </span>
        </div>
        {ctx && <Status ctx={ctx} className={k.trackStatus} />}
      </div>
      {ctx ? (
        <TrackActions
          key={ctx.key}
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
function QuietRow({ track, day, onPerson }: { track: Track; day: Day; onPerson: () => void }) {
  const { person } = track;
  const last = lastExchange(person, day);
  const followUp = day.index.openActionsFor(person.id).find((a) => a.kind === "follow_up");
  const subject =
    last && (last.kind === "message_sent" || last.kind === "message_received")
      ? last.subject
      : undefined;
  const state = day.outreachOf(person.id);
  return (
    <li className={k.quietRow}>
      <Avatar name={person.name} size={32} />
      <span className={s.rowText}>
        <button type="button" className={k.quietName} onClick={onPerson}>
          {person.name}
        </button>
        <span className={s.rowSub}>
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

const PATH: { title: string; rule: string; groups: GroupKey[] }[] = [
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

export function Outreach({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const { announce, view: toast } = useAnnouncer(day);
  const groups = tracksOf(day);
  const [closedOpen, setClosedOpen] = useState(false);

  const openPerson = (person: Person) => goToPerson(navigate, person.id);
  const jump = (key: GroupKey) => {
    if (key === "closed") setClosedOpen(true);
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      document
        .getElementById(`outreach-${key}`)
        ?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" }),
    );
  };
  // People whose first message is planned sit in To write, but haven't reached the path yet.
  const pathCount = (keys: GroupKey[]) =>
    keys.reduce(
      (n, key) =>
        n +
        groups[key].filter((t) => key !== "write" || day.outreachOf(t.person.id) !== "not_started")
          .length,
      0,
    );

  return (
    <AppFrame active="outreach" day={day} navigate={navigate}>
      <div className={k.outreach}>
        <div className={`${s.stage} ${s.scroll}`}>
          <header className={s.pageHead}>
            <h1 className={s.pageTitle}>Outreach</h1>
            <span className={s.pageSub}>{summary(groups)}</span>
          </header>

          {SECTIONS.map((section) => {
            const tracks = groups[section.key];
            if (tracks.length === 0) return null;
            const quiet = section.key === "waiting" || section.key === "conversation";
            return (
              <section
                key={section.key}
                id={`outreach-${section.key}`}
                className={k.section}
                aria-labelledby={`outreach-${section.key}-title`}
              >
                <header className={k.sectionHead}>
                  <StateMark tone={section.tone} icon={section.icon} />
                  <div>
                    <h2 id={`outreach-${section.key}-title`} className={k.sectionTitle}>
                      {section.title} <span>{tracks.length}</span>
                    </h2>
                    <p className={k.sectionHint}>{section.hint}</p>
                  </div>
                </header>
                <ol className={quiet ? k.quietList : k.tracks}>
                  {tracks.map((t) =>
                    quiet ? (
                      <QuietRow
                        key={t.person.id}
                        track={t}
                        day={day}
                        onPerson={() => openPerson(t.person)}
                      />
                    ) : (
                      <TrackItem
                        key={t.person.id}
                        track={t}
                        day={day}
                        announce={announce}
                        onPerson={() => openPerson(t.person)}
                        approved={section.key === "send"}
                      />
                    ),
                  )}
                </ol>
              </section>
            );
          })}

          {groups.quiet.length > 0 && (
            <details className={k.more}>
              <summary className={k.moreSummary}>
                Not contacted yet <span>{groups.quiet.length}</span>
              </summary>
              <ol className={k.quietList}>
                {groups.quiet.map((t) => (
                  <QuietRow
                    key={t.person.id}
                    track={t}
                    day={day}
                    onPerson={() => openPerson(t.person)}
                  />
                ))}
              </ol>
            </details>
          )}
          {groups.closed.length > 0 && (
            <details
              id="outreach-closed"
              className={k.more}
              open={closedOpen}
              onToggle={(e) => setClosedOpen(e.currentTarget.open)}
            >
              <summary className={k.moreSummary}>
                Closed <span>{groups.closed.length}</span>
              </summary>
              <ol className={k.quietList}>
                {groups.closed.map((t) => (
                  <QuietRow
                    key={t.person.id}
                    track={t}
                    day={day}
                    onPerson={() => openPerson(t.person)}
                  />
                ))}
              </ol>
            </details>
          )}
          {toast}
        </div>

        <aside className={`${s.day} ${s.scroll}`} aria-labelledby="outreach-path">
          <div className={s.dayHead}>
            <h2 id="outreach-path" className={s.dayTitle}>
              How a message moves
            </h2>
          </div>
          <ol className={k.path}>
            {PATH.map((step) => {
              const count = pathCount(step.groups);
              const target = step.groups.find((g) => groups[g].length > 0);
              return (
                <li key={step.title} className={k.pathStep} data-empty={count === 0 || undefined}>
                  <button
                    type="button"
                    className={k.pathButton}
                    disabled={!target}
                    onClick={() => target && jump(target)}
                  >
                    <span className={k.pathNode}>{count}</span>
                    <span className={s.rowText}>
                      <span className={k.pathTitle}>{step.title}</span>
                      <span className={k.pathRule}>{step.rule}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className={s.later}>
            Reachout never sends anything on its own. Every message is approved, sent and marked as
            sent by you.
          </p>
        </aside>
      </div>
    </AppFrame>
  );
}

/* ——— Phone: a list of who needs what, then one person at a time ——— */

/** One line saying what this person needs from you, in words, with its colour. */
function rowStatus(track: Track, day: Day): { text: string; tone: Tone } {
  if (track.ctx) return statusFor(track.ctx);
  const { person } = track;
  if (day.outreachOf(person.id) === "closed") return { text: "Closed", tone: undefined };
  return { text: lastLine(person, day) ?? "Not contacted yet", tone: undefined };
}

/** The state of someone who needs nothing from you right now. */
function QuietCard({ person, day }: { person: Person; day: Day }) {
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
    <div className={k.mCard}>
      <h2 className={s.mHeadline}>{headline}</h2>
      <p className={s.mStatus}>
        {state === "closed" && person.outreachClosure
          ? `Closed ${ago(day.index.daysSince(person.outreachClosure.closedAt))}${person.outreachClosure.reason === "no_response" ? " · no response" : ""}`
          : (lastLine(person, day) ?? "Nothing sent yet")}
      </p>
      {last && (
        <div className={k.quote}>
          <p className={s.label}>
            <Icon.ArrowUpRight size={14} weight={2} />
            {last.kind === "message_sent" ? "What you sent" : "Last time"}
          </p>
          <p className={s.cellText}>{last.summary}</p>
        </div>
      )}
      {state === "not_started" && person.whyRelevant && (
        <div className={k.quote}>
          <p className={s.whyLabel}>
            <Icon.Compass size={14} weight={2} />
            Why {first} matters
          </p>
          <p className={k.quoteWhy}>{person.whyRelevant}</p>
        </div>
      )}
      {followUp && (
        <div className={k.mPlanned}>
          <Tile small date={followUp.dueOn} tone={undefined} />
          <span className={s.rowText}>
            <span className={s.rowTitle}>{followUp.title}</span>
            <span className={s.rowSub}>Planned for {shortDay(followUp.dueOn)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function MobileTrack({
  person,
  track,
  day,
  announce,
  navigate,
}: {
  person: Person;
  track?: Track;
  day: Day;
  announce: Announce;
  navigate: SurfaceProps["navigate"];
}) {
  const opportunity = track?.ctx?.opportunity ?? day.index.opportunitiesOf(person.id)[0];
  const moments = day.index.historyOf(person.id).length;
  return (
    <>
      <section className={k.mFirst} aria-label="What to do">
        {track?.ctx ? (
          <MobileAction key={track.ctx.key} ctx={track.ctx} day={day} announce={announce} full>
            <Context ctx={track.ctx} person={person} />
          </MobileAction>
        ) : (
          <QuietCard person={person} day={day} />
        )}
      </section>

      {opportunity && (
        <section className={s.mSection} aria-label="What it's for">
          <button
            type="button"
            className={s.mNext}
            onClick={() => goToOpportunity(navigate, opportunity.id)}
          >
            <span className={k.mMarkCell}>
              <Icon.Target size={20} weight={1.75} />
            </span>
            <span className={s.rowText}>
              <span className={`${s.mNextTitle} ${s.oppName}`}>{opportunity.title}</span>
              <span className={s.rowSub}>What this outreach is for</span>
            </span>
            <Icon.ChevronRight size={18} weight={2} />
          </button>
        </section>
      )}

      <section className={s.mSection} aria-labelledby="m-track-history">
        <div className={s.mSectionHead}>
          <h2 id="m-track-history" className={s.mSectionTitle}>
            Between you
          </h2>
          <span className={s.dayCount}>{moments}</span>
        </div>
        <div className={k.mCard}>
          <History person={person} day={day} initial={3} dense />
        </div>
      </section>

      <section className={s.mSection} aria-label="More">
        <button
          type="button"
          className={`${s.secondary} ${k.mWide}`}
          onClick={() => goToPerson(navigate, person.id)}
        >
          Everything about {firstName(person.name)}
          <Icon.ArrowRight size={16} weight={2} />
        </button>
      </section>
    </>
  );
}

export function OutreachMobile({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const { announce, view: toast } = useAnnouncer(day);
  const groups = tracksOf(day);
  const [openId, setOpenId] = useState<PersonId | undefined>();
  const firstKey = SECTIONS.find((section) => groups[section.key].length > 0)?.key;
  const open = day.index.person(openId);

  if (open) {
    const track = Object.values(groups)
      .flat()
      .find((t) => t.person.id === open.id);
    const company = day.index.companyOf(open);
    return (
      <MobileShell
        key={open.id}
        day={day}
        navigate={navigate}
        active="outreach"
        title={open.name}
        subtitle={[open.role, company?.name].filter(Boolean).join(" · ")}
        leading={<Avatar name={open.name} size={44} />}
        back={{ label: "Outreach", onClick: () => setOpenId(undefined) }}
        detail
        tight
        toast={toast}
      >
        <MobileTrack
          person={open}
          track={track}
          day={day}
          announce={announce}
          navigate={navigate}
        />
      </MobileShell>
    );
  }

  const list = (tracks: Track[]) => (
    <ul className={`${s.mList} ${k.mTrackList}`}>
      {tracks.map((t) => {
        const status = rowStatus(t, day);
        return (
          <li key={t.person.id}>
            <button
              type="button"
              className={`${s.row} ${k.mTrackRow}`}
              onClick={() => setOpenId(t.person.id)}
            >
              <Avatar name={t.person.name} size={36} />
              <span className={k.rowMain}>
                <span className={s.rowText}>
                  <span className={s.rowTitle}>{t.person.name}</span>
                  <span className={k.mRowStatus} data-tone={status.tone}>
                    {status.tone && (
                      <span className={s.dot} data-tone={status.tone} aria-hidden="true" />
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
    <MobileShell
      key="list"
      day={day}
      navigate={navigate}
      active="outreach"
      title="Outreach"
      subtitle={summary(groups)}
      toast={toast}
    >
      {SECTIONS.map((section) => {
        const tracks = groups[section.key];
        if (tracks.length === 0) return null;
        return (
          <section
            key={section.key}
            className={section.key === firstKey ? k.mFirst : s.mSection}
            aria-labelledby={`m-out-${section.key}`}
          >
            <div className={k.mStateHead}>
              <StateMark tone={section.tone} icon={section.icon} />
              <h2 id={`m-out-${section.key}`} className={s.mSectionTitle}>
                {section.title}
              </h2>
              <span className={s.dayCount}>{tracks.length}</span>
            </div>
            {list(tracks)}
          </section>
        );
      })}
      {groups.quiet.length > 0 && (
        <details className={s.mSection}>
          <summary className={k.mClosedSummary}>
            Not contacted yet <span className={s.dayCount}>{groups.quiet.length}</span>
          </summary>
          {list(groups.quiet)}
        </details>
      )}
      {groups.closed.length > 0 && (
        <details className={s.mSection}>
          <summary className={k.mClosedSummary}>
            Closed <span className={s.dayCount}>{groups.closed.length}</span>
          </summary>
          {list(groups.closed)}
        </details>
      )}
      <p className={k.mFootnote}>Reachout never sends anything on its own.</p>
    </MobileShell>
  );
}
