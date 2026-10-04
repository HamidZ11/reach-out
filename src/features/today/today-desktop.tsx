"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/avatar";
import { ago, longDay, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import { addDays } from "@/domain/time";
import { TODAY_RULES } from "@/domain/today";
import { SECTIONS } from "@/features/sections";
import type { ItemContext } from "@/features/workspace/records";
import {
  channelOf,
  deadlineText,
  firstName,
  listOf,
  OUTREACH_LABEL,
  STAGE_LABEL,
} from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { tileFor } from "./date-tile";
import type { Announce, Announcer } from "./item-actions";
import { ActionButton, useItemActions } from "./item-actions";
import { Standing, Status } from "./person";
import s from "./today.module.css";
import type { Focus } from "./use-focus";
import { GROUPS, headline, lastExchange, rowLines, stableKey, statusFor } from "./wording";

type Cell = { key: string; label: string; icon: ReactNode; body: ReactNode };

function cellsView(cells: Cell[]) {
  return cells.map((c) => (
    <section key={c.key} className={s.cell} aria-label={c.label}>
      <h3 className={s.label}>
        {c.icon}
        {c.label}
      </h3>
      {c.body}
    </section>
  ));
}

/** The context band: why this matters, what happened last, and what it's for. */
function Brief({
  ctx,
  day,
  announce,
}: {
  ctx: ItemContext;
  day: WorkspaceState;
  announce: Announce;
}) {
  const { item, person, opportunity, draft } = ctx;
  const first = person ? firstName(person.name) : "";
  const cells: Cell[] = [];

  if (item.kind === "deadline_approaching" && opportunity) {
    const steps = day.records.nextActions.filter(
      (a) => a.status === "open" && a.opportunityId === opportunity.id,
    );
    cells.push({
      key: "steps",
      label: "Still to do",
      icon: <Icon.Check size={14} weight={2} />,
      body: steps.length ? (
        <ul className={s.steps}>
          {steps.map((a) => (
            <li key={a.id} className={s.step}>
              <span>
                {a.title}
                <span className={s.cellMeta}> · {shortDay(a.dueOn)}</span>
              </span>
              <button
                type="button"
                className={`${s.text} ${s.small}`}
                onClick={() => {
                  day.complete(a.id);
                  announce(`Done: ${a.title}.`);
                }}
              >
                Done
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.cellText}>Nothing planned for this one yet.</p>
      ),
    });
    const people = day.index.peopleOf(opportunity);
    cells.push({
      key: "people",
      label: "People there",
      icon: <Icon.People size={14} weight={2} />,
      body: (
        <ul className={s.steps}>
          {people.map((p) => (
            <li key={p.id} className={s.step}>
              <span>{p.name}</span>
              <span className={s.cellMeta}>{OUTREACH_LABEL[day.outreachOf(p.id)]}</span>
            </li>
          ))}
        </ul>
      ),
    });
    return <div className={s.brief}>{cellsView(cells)}</div>;
  }

  const why = person?.whyRelevant
    ? { label: `Why ${first} matters`, text: person.whyRelevant }
    : person?.notes
      ? { label: "Your note", text: person.notes }
      : !person && opportunity?.notes
        ? { label: "Your notes", text: opportunity.notes }
        : undefined;
  if (why) {
    cells.push({
      key: "why",
      label: why.label,
      icon: <Icon.Note size={14} weight={2} />,
      body: <p className={s.cellText}>{why.text}</p>,
    });
  }

  const last = !draft && person ? (ctx.message ?? lastExchange(person, day)) : undefined;
  if (last) {
    const since = day.index.daysSince(last.occurredAt);
    const label =
      last.kind === "message_received"
        ? `${first}'s reply`
        : last.kind === "meeting"
          ? "When you met"
          : "What you sent";
    cells.push({
      key: "last",
      label,
      icon: <Icon.Chat size={14} weight={2} />,
      body: (
        <>
          <p className={s.cellText}>{last.summary}</p>
          <p className={s.cellMeta}>
            {channelOf(last)} · {ago(since)}
          </p>
        </>
      ),
    });
  }

  if (opportunity) {
    cells.push({
      key: "for",
      label: "For",
      icon: <Icon.Target size={14} weight={2} />,
      body: (
        <>
          <p className={`${s.cellText} ${s.oppName}`}>{opportunity.title}</p>
          <p className={s.cellMeta}>
            {[STAGE_LABEL[opportunity.status], deadlineText(opportunity.deadline, day.today)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </>
      ),
    });
  }

  return cells.length ? <div className={s.brief}>{cellsView(cells)}</div> : null;
}

function FocusItem({
  ctx,
  day,
  announce,
  onSkip,
  autoFocus,
}: {
  ctx: ItemContext;
  day: WorkspaceState;
  announce: Announce;
  onSkip: () => void;
  autoFocus: boolean;
}) {
  const actions = useItemActions(ctx, day, announce);
  const heading = useRef<HTMLHeadingElement>(null);
  const { item, person, company, opportunity, draft } = ctx;

  useEffect(() => {
    if (autoFocus) heading.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const people =
    item.kind === "deadline_approaching" && opportunity ? day.index.peopleOf(opportunity) : [];

  return (
    <article className={s.focus} aria-labelledby="focus-headline">
      <div className={s.focusHead}>
        {tileFor(ctx, day)}
        <div>
          <h2 id="focus-headline" ref={heading} tabIndex={-1} className={s.headline}>
            {headline(ctx)}
          </h2>
          <Status ctx={ctx} className={s.status} />
        </div>
      </div>

      {person ? (
        <div className={s.who}>
          <Avatar name={person.name} size={40} />
          <div className={s.whoText}>
            <Link href={SECTIONS.people.href} className={s.whoName}>
              {person.name}
            </Link>
            <span className={s.whoMeta}>
              {[person.role, company?.name].filter(Boolean).join(" · ")}
            </span>
          </div>
          <span className={s.pushRight}>
            <Standing person={person} day={day} withLastContact={false} />
          </span>
        </div>
      ) : people.length > 0 ? (
        <div className={s.who}>
          <span className={s.stack}>
            {people.slice(0, 3).map((p) => (
              <Avatar key={p.id} name={p.name} size={32} />
            ))}
          </span>
          <span className={s.whoMeta}>
            You know {listOf(people.map((p) => firstName(p.name)))} at {company?.name}
          </span>
        </div>
      ) : null}

      <Brief ctx={ctx} day={day} announce={announce} />

      {draft && actions.mode !== "edit" && (
        <div className={s.letter}>
          {draft.subject && <span className={s.letterSubject}>{draft.subject}</span>}
          {draft.body}
        </div>
      )}
      {actions.composer}

      <div className={s.actions}>
        {actions.mode ? (
          <button type="button" className={s.text} onClick={actions.close}>
            {actions.hasText ? "Hide draft — keeps your text" : "Cancel"}
          </button>
        ) : (
          <>
            {actions.primary && <ActionButton spec={actions.primary} variant="primary" />}
            {actions.secondary.map((a, i) => (
              <ActionButton key={a.id} spec={a} variant={i === 0 ? "secondary" : "text"} />
            ))}
          </>
        )}
        <button type="button" className={`${s.text} ${s.pushRight}`} onClick={onSkip}>
          Skip for now <Icon.Skip size={14} />
        </button>
      </div>
    </article>
  );
}

function DayPanel({ day, focus }: { day: WorkspaceState; focus: Focus }) {
  const horizon = addDays(day.today, TODAY_RULES.upcomingWindowDays);
  const shown = new Set(day.contexts.map((c) => c.action?.id).filter(Boolean));
  const later = day.records.nextActions
    .filter((a) => a.status === "open" && a.dueOn > horizon && !shown.has(a.id))
    .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn))[0];

  return (
    <aside className={`${s.day} ${s.scroll}`} aria-label="Your day">
      <div className={s.dayHead}>
        <h2 className={s.dayTitle}>Your day</h2>
        <span className={s.dayCount}>{day.contexts.length} left</span>
      </div>
      {GROUPS.map((g) => {
        const items = day.contexts.filter((c) => g.tiers.includes(c.item.tier));
        if (items.length === 0) return null;
        return (
          <section key={g.label} aria-label={g.label}>
            <h3 className={s.groupLabel}>{g.label}</h3>
            <ol className={s.rows}>
              {items.map((ctx) => {
                const lines = rowLines(ctx);
                return (
                  <li key={ctx.key}>
                    <button
                      type="button"
                      className={s.row}
                      aria-current={ctx === focus.current ? "true" : undefined}
                      onClick={() => focus.choose(ctx)}
                    >
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
        );
      })}
      {day.finished.length > 0 && (
        <details className={s.doneList}>
          <summary>Done today · {day.finished.length}</summary>
          <ul>
            {day.finished.map((f) => (
              <li key={`${f.label}-${f.at}`} className={s.doneItem}>
                <Icon.Check size={14} />
                {f.label}
              </li>
            ))}
          </ul>
        </details>
      )}
      {later && (
        <p className={s.later}>
          After today: {later.title} · {shortDay(later.dueOn)}
        </p>
      )}
    </aside>
  );
}

/**
 * Desktop Today: the current item dominates; the rest of the day waits beside
 * it. Every action is an explicit click or tap — there are no single-key
 * shortcuts, which were too easy to trigger by accident.
 */
export function TodayDesktop({
  day,
  focus,
  announcer,
}: {
  day: WorkspaceState;
  focus: Focus;
  announcer: Announcer;
}) {
  const { announce, view: toast, acted } = announcer;
  const current = focus.current;

  return (
    <div className={s.today}>
      <div className={`${s.stage} ${s.scroll}`}>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Today</h1>
          <span className={s.pageSub}>{longDay(day.today)}</span>
          {current && (
            <span className={s.progress}>
              <span>
                {focus.position} of {day.contexts.length}
              </span>
              {day.finished.length ? ` · ${day.finished.length} done` : ""}
            </span>
          )}
        </header>

        {current ? (
          <FocusItem
            key={stableKey(current)}
            ctx={current}
            day={day}
            announce={announce}
            onSkip={focus.skip}
            autoFocus={acted}
          />
        ) : (
          <div className={s.clear}>
            <h2 className={s.headline}>You&apos;re clear for today.</h2>
            <p className={s.status}>Everything with a date is further out.</p>
          </div>
        )}

        {focus.next && (
          <div className={s.upNext}>
            <span className={s.upNextLabel}>Then</span>
            <button
              type="button"
              className={s.upNextButton}
              onClick={() => focus.next && focus.choose(focus.next)}
            >
              {tileFor(focus.next, day, true)}
              <span className={s.upNextText}>
                <span className={s.upNextTitle}>{headline(focus.next)}</span>
                <span className={s.upNextSub}>{statusFor(focus.next).text}</span>
              </span>
              <Icon.ArrowRight size={16} weight={2} />
            </button>
          </div>
        )}
        {toast}
      </div>
      <DayPanel day={day} focus={focus} />
    </div>
  );
}
