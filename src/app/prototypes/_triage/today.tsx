"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { clock, longDay, shortDay } from "../_shared/dates";
import type { ItemContext } from "../_shared/snapshot";
import { deadlineText, firstName, OUTREACH_LABEL, STAGE_LABEL } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import {
  Composer,
  DraftActions,
  GROUPS,
  gutter,
  Kbd,
  kindIcon,
  PersonHeader,
  Rail,
  Research,
  rowCopy,
  snoozeLabel,
  Thread,
} from "./parts";
import s from "./triage.module.css";

const KIND_LABEL: Record<ItemContext["item"]["kind"], string> = {
  overdue_follow_up: "Overdue follow-up",
  reply_awaiting_response: "Waiting on your reply",
  deadline_approaching: "Deadline",
  draft_awaiting_approval: "Draft · needs approval",
  draft_ready_to_send: "Approved · not sent",
  upcoming_action: "Next step",
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);

/** Selection survives the selected item leaving the queue: the next one slides into its place. */
function useSelection(contexts: ItemContext[]) {
  const [selection, setSelection] = useState({ key: contexts[0]?.key, index: 0 });
  const found = contexts.findIndex((c) => c.key === selection.key);
  const index = found >= 0 ? found : Math.min(selection.index, contexts.length - 1);
  const select = (i: number) => {
    const target = contexts[i];
    if (target) setSelection({ key: target.key, index: i });
  };
  return { index, selected: contexts[index], select };
}

function ContextPanel({
  ctx,
  day,
  composerRef,
}: {
  ctx: ItemContext;
  day: Day;
  composerRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const { item, person, opportunity, action, draft } = ctx;
  const tone = gutter(ctx).tone;
  const writable =
    person !== undefined &&
    (item.kind === "overdue_follow_up" ||
      item.kind === "reply_awaiting_response" ||
      item.kind === "upcoming_action");
  const snooze = snoozeLabel(ctx, day);

  return (
    <aside className={s.panel} aria-label="Context">
      <div className={s.panelScroll}>
        {person ? (
          <PersonHeader person={person} day={day} />
        ) : opportunity ? (
          <>
            <h2 className={s.personName}>{opportunity.title}</h2>
            <div className={s.personRole}>{ctx.company?.name}</div>
          </>
        ) : null}

        <div className={s.focus}>
          <span className={s.focusKind} data-tone={tone === "late" ? "late" : undefined}>
            {KIND_LABEL[item.kind]}
            {item.kind === "deadline_approaching" ? ` · ${longDay(item.deadline)}` : ""}
            {action ? ` · due ${shortDay(action.dueOn)}` : ""}
          </span>
          <p className={s.focusTitle}>{rowCopy(ctx, day).title}</p>
          {action?.status === "open" && (
            <div className={s.buttons}>
              <button
                type="button"
                className={s.button}
                data-primary=""
                onClick={() => day.complete(action.id)}
              >
                Done <Kbd>E</Kbd>
              </button>
              {snooze && (
                <button type="button" className={s.button} onClick={() => day.snooze(action.id)}>
                  Snooze to {snooze} <Kbd>S</Kbd>
                </button>
              )}
            </div>
          )}
          {item.kind === "reply_awaiting_response" && (
            <div className={s.buttons}>
              <button
                type="button"
                className={s.button}
                data-primary=""
                onClick={() => composerRef.current?.focus()}
              >
                Write reply <Kbd>↵</Kbd>
              </button>
            </div>
          )}
          {draft && <DraftActions draft={draft} day={day} onDone={setToast} />}
        </div>
        {toast && (
          <p className={s.toast} role="status">
            {toast}
          </p>
        )}

        {person?.whyRelevant && (
          <section className={s.section}>
            <h3 className={s.label}>Why {firstName(person.name)}</h3>
            <p className={s.why}>{person.whyRelevant}</p>
          </section>
        )}

        {opportunity && (
          <section className={s.section}>
            <h3 className={s.label}>
              <span>Opportunity</span>
              <span className={s.mono}>{STAGE_LABEL[opportunity.status].toLowerCase()}</span>
            </h3>
            <div className={s.oppLine}>
              <span>{opportunity.title}</span>
              <span className={s.oppMeta}>
                {deadlineText(opportunity.deadline, day.today) ?? "no deadline"}
              </span>
            </div>
            {item.kind === "deadline_approaching" && (
              <>
                {day.index.peopleOf(opportunity).map((p) => (
                  <div key={p.id} className={s.oppLine}>
                    <span className={s.dim}>
                      {p.name} · {p.role}
                    </span>
                    <span className={s.oppMeta}>
                      {OUTREACH_LABEL[day.outreachOf(p.id)].toLowerCase()}
                    </span>
                  </div>
                ))}
                {day.records.nextActions
                  .filter((a) => a.status === "open" && a.opportunityId === opportunity.id)
                  .map((a) => (
                    <div key={a.id} className={s.oppLine}>
                      <span>{a.title}</span>
                      <span className={s.oppMeta}>{shortDay(a.dueOn)}</span>
                    </div>
                  ))}
              </>
            )}
          </section>
        )}

        {person && (
          <section className={s.section}>
            <h3 className={s.label}>Thread</h3>
            <Thread person={person} day={day} />
          </section>
        )}
        {person && <Research person={person} day={day} />}
      </div>
      {writable && person && (
        <Composer
          key={ctx.key}
          ref={composerRef}
          person={person}
          ctx={ctx}
          day={day}
          onSaved={setToast}
        />
      )}
    </aside>
  );
}

export function Today({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const { index, selected, select } = useSelection(day.contexts);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const move = (to: number) => {
      const target = day.contexts[to];
      if (!target) return;
      select(to);
      rows.current.get(target.key)?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const action = selected?.action;
      const draft = selected?.draft;
      switch (event.key) {
        case "j":
        case "ArrowDown":
          event.preventDefault();
          move(index + 1);
          break;
        case "k":
        case "ArrowUp":
          event.preventDefault();
          move(index - 1);
          break;
        case "e":
          if (action?.status === "open") day.complete(action.id);
          break;
        case "s":
          if (action?.status === "open") day.snooze(action.id);
          break;
        case "a":
          if (draft?.status === "awaiting_approval") day.approve(draft.id);
          break;
        case "m":
          if (draft?.status === "approved") day.markSent(draft.id);
          break;
        case "Enter":
          // Only from a queue row; Enter on any other button keeps its normal meaning.
          if (
            composerRef.current &&
            event.target instanceof HTMLElement &&
            event.target.closest('[role="option"]')
          ) {
            event.preventDefault();
            composerRef.current.focus();
          }
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [day, index, selected, select]);

  return (
    <div className={s.root}>
      <div className={s.app}>
        <Rail active="today" day={day} navigate={navigate} />
        <main className={s.queue}>
          <header className={s.queueHead}>
            <h1 className={s.title}>Today</h1>
            <span className={s.headDate}>{shortDay(day.today)}</span>
            <span className={s.keys} aria-hidden="true">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd> move <Kbd>E</Kbd> done <Kbd>S</Kbd> snooze <Kbd>A</Kbd> approve
            </span>
          </header>
          <div className={s.scroll}>
            {day.contexts.length === 0 && (
              <p className={s.empty}>Queue clear. Nothing needs you today.</p>
            )}
            {GROUPS.map(({ tier, label }) => {
              const group = day.contexts.filter((c) => c.item.tier === tier);
              if (group.length === 0) return null;
              return (
                <section key={tier} aria-label={label}>
                  <h2 className={s.group}>
                    {label} <span className={s.groupCount}>{group.length}</span>
                  </h2>
                  <ul className={s.rows} role="listbox" aria-label={label}>
                    {group.map((ctx) => {
                      const g = gutter(ctx);
                      const copy = rowCopy(ctx, day);
                      const i = day.contexts.indexOf(ctx);
                      return (
                        <li key={ctx.key} role="presentation">
                          <button
                            ref={(el) => {
                              if (el) rows.current.set(ctx.key, el);
                              else rows.current.delete(ctx.key);
                            }}
                            type="button"
                            role="option"
                            aria-selected={i === index}
                            className={s.row}
                            onClick={() => select(i)}
                          >
                            <span className={s.when} data-tone={g.tone}>
                              {g.text}
                            </span>
                            <span className={s.kindIcon}>{kindIcon(ctx)}</span>
                            <span>
                              <span className={s.rowTitle}>{copy.title}</span>
                              <span className={s.rowSub}>{copy.sub}</span>
                            </span>
                            <span className={s.rowKey}>
                              {ctx.action ? (
                                <Kbd>E</Kbd>
                              ) : ctx.draft?.status === "awaiting_approval" ? (
                                <Kbd>A</Kbd>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {day.finished.length > 0 && (
              <div className={s.cleared}>
                {day.finished.map((f) => (
                  <div key={`${f.label}-${f.at}`} className={s.clearedRow}>
                    <span className={s.mono}>{clock(f.at, day.user.timeZone)}</span>
                    <s>{f.label}</s>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
        {selected ? (
          <ContextPanel key={selected.key} ctx={selected} day={day} composerRef={composerRef} />
        ) : (
          <aside className={s.panel} aria-label="Context">
            <p className={s.empty}>Nothing selected.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
