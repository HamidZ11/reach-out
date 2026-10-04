"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { longDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { Person } from "@/domain/person";
import { SECTIONS } from "@/features/sections";
import type { ItemContext } from "@/features/workspace/records";
import { firstName } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { tileFor } from "./date-tile";
import type { ActionSpec, Announce, Announcer } from "./item-actions";
import { ActionButton, useItemActions } from "./item-actions";
import { PersonSheet, Status } from "./person";
import s from "./today.module.css";
import type { Focus } from "./use-focus";
import { headline, lastExchange, rowLines, stableKey, statusFor } from "./wording";

/** Labels that fit two to a thumb-width row: "Snooze to Mon 5 Oct" → "Snooze to Mon". */
function compact(spec: ActionSpec): ActionSpec {
  if (spec.id === "snooze") return { ...spec, label: spec.label.split(" ").slice(0, 3).join(" ") };
  if (spec.id === "open") return { ...spec, label: "Open posting" };
  return spec;
}

/** The current item as one card: one primary action, then what else applies, then Skip. */
function PhoneFocus({
  ctx,
  day,
  announce,
  onSkip,
  onPerson,
}: {
  ctx: ItemContext;
  day: WorkspaceState;
  announce: Announce;
  onSkip: () => void;
  onPerson: (person: Person) => void;
}) {
  const actions = useItemActions(ctx, day, announce);
  const [whyOpen, setWhyOpen] = useState(false);
  const { person, company, draft } = ctx;
  const first = person ? firstName(person.name) : "";
  const last = !draft && person ? (ctx.message ?? lastExchange(person, day)) : undefined;
  const why = person?.whyRelevant
    ? { label: `Why ${first} matters`, text: person.whyRelevant }
    : person?.notes
      ? { label: "Your note", text: person.notes }
      : undefined;

  return (
    <article className={s.mFocus} aria-labelledby="m-focus-headline">
      <div className={s.mHead}>
        {tileFor(ctx, day)}
        <div>
          <h2 id="m-focus-headline" className={s.mHeadline}>
            {headline(ctx)}
          </h2>
          <Status ctx={ctx} className={s.mStatus} />
        </div>
      </div>

      {person && (
        <button type="button" className={s.mWho} onClick={() => onPerson(person)}>
          <Avatar name={person.name} size={38} />
          <span className={s.rowText}>
            <span className={s.pName}>{person.name}</span>
            <span className={s.pRole}>
              {[person.role, company?.name].filter(Boolean).join(" · ")}
            </span>
          </span>
          <Icon.ChevronRight size={18} weight={2} />
        </button>
      )}

      {why && (
        <div className={s.mWhy}>
          <h3 className={s.whyLabel}>
            <Icon.Compass size={14} weight={2} />
            {why.label}
          </h3>
          <p className={whyOpen ? s.mWhyText : `${s.mWhyText} ${s.mClamp}`}>{why.text}</p>
          {!whyOpen && why.text.length > 90 && (
            <button type="button" className={s.mMore} onClick={() => setWhyOpen(true)}>
              Read all <Icon.ChevronDown size={14} weight={2} />
            </button>
          )}
        </div>
      )}

      {last && (
        <div className={s.mContext}>
          <h3 className={s.label}>
            <Icon.Chat size={14} weight={2} />
            {last.kind === "message_received"
              ? `${first}'s reply`
              : last.kind === "meeting"
                ? "When you met"
                : "What you sent"}
          </h3>
          <p className={`${s.cellText} ${s.mClamp}`}>{last.summary}</p>
        </div>
      )}
      {draft && actions.mode !== "edit" && (
        <div className={`${s.letter} ${s.mClamp}`}>
          {draft.subject && <span className={s.letterSubject}>{draft.subject}</span>}
          {draft.body}
        </div>
      )}

      {actions.composer}

      <div className={s.mActions}>
        {actions.mode ? (
          <button type="button" className={s.secondary} onClick={actions.close}>
            Hide draft — keeps your text
          </button>
        ) : (
          actions.primary && <ActionButton spec={actions.primary} variant="primary" />
        )}
        {!actions.mode && actions.secondary.length > 0 && (
          <div className={s.mRow}>
            {actions.secondary.slice(0, 2).map((a) => (
              <ActionButton key={a.id} spec={compact(a)} variant="secondary" />
            ))}
          </div>
        )}
        <button type="button" className={`${s.text} ${s.mSkip}`} onClick={onSkip}>
          Skip for now <Icon.Skip size={14} weight={2} />
        </button>
      </div>
    </article>
  );
}

/** Phone Today: focus first, then what's up next, then the rest of the day. */
export function TodayPhone({
  day,
  focus,
  announcer,
}: {
  day: WorkspaceState;
  focus: Focus;
  announcer: Announcer;
}) {
  const { announce, view: toast } = announcer;
  const [sheet, setSheet] = useState<Person | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const current = focus.current;
  const rest = day.contexts.filter((c) => c !== current);
  const [upNext, ...later] = rest;

  const choose = (ctx: ItemContext) => {
    focus.choose(ctx);
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    top.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  };

  return (
    <>
      <div ref={top} className={s.mTop}>
        <span className={s.mMark} aria-hidden="true">
          r
        </span>
        <Link href={SECTIONS.settings.href} className={s.mAvatar} aria-label="Settings">
          <Avatar name={day.user.name} size={32} />
        </Link>
      </div>
      <header className={s.mHeading}>
        <h1 className={s.mTitle}>Today</h1>
        <span className={s.mDate}>
          {longDay(day.today)} · {day.contexts.length} left
          {day.finished.length ? `, ${day.finished.length} done` : ""}
        </span>
      </header>

      <div className={s.mBody}>
        {current ? (
          <PhoneFocus
            key={stableKey(current)}
            ctx={current}
            day={day}
            announce={announce}
            onSkip={focus.skip}
            onPerson={setSheet}
          />
        ) : (
          <div className={s.mFocus}>
            <h2 className={s.mHeadline}>You&apos;re clear for today.</h2>
            <p className={s.mStatus}>Everything with a date is further out.</p>
          </div>
        )}

        {upNext && (
          <section className={s.mSection} aria-labelledby="m-upnext">
            <div className={s.mSectionHead}>
              <h2 id="m-upnext" className={s.mSectionTitle}>
                Up next
              </h2>
            </div>
            <button type="button" className={s.mNext} onClick={() => choose(upNext)}>
              {tileFor(upNext, day)}
              <span className={s.rowText}>
                <span className={s.mNextTitle}>{headline(upNext)}</span>
                <span className={s.rowSub}>{statusFor(upNext).text}</span>
              </span>
              <Icon.ChevronRight size={18} weight={2} />
            </button>
          </section>
        )}

        {later.length > 0 && (
          <section className={s.mSection} aria-labelledby="m-then">
            <div className={s.mSectionHead}>
              <h2 id="m-then" className={s.mSectionTitle}>
                Then
              </h2>
              <span className={s.dayCount}>{later.length}</span>
            </div>
            <ol className={s.mList}>
              {later.map((ctx) => {
                const lines = rowLines(ctx);
                return (
                  <li key={ctx.key}>
                    <button type="button" className={s.row} onClick={() => choose(ctx)}>
                      {tileFor(ctx, day, true)}
                      <span className={s.rowText}>
                        <span className={s.rowTitle}>{lines.primary}</span>
                        <span className={s.rowSub}>{lines.secondary}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
      {toast}

      {sheet && (
        <PersonSheet key={sheet.id} person={sheet} day={day} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
