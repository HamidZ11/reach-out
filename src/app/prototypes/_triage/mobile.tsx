"use client";

import { useEffect, useRef, useState } from "react";
import { clock, shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { ItemContext } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import {
  Composer,
  DraftActions,
  GROUPS,
  gutter,
  PersonHeader,
  rowCopy,
  snoozeLabel,
  Thread,
} from "./parts";
import s from "./triage.module.css";

/** On a phone the context panel becomes a sheet over the queue. */
function Sheet({ ctx, day, onClose }: { ctx: ItemContext; day: Day; onClose: () => void }) {
  const [toast, setToast] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { person, action, draft, item } = ctx;
  const snooze = snoozeLabel(ctx, day);
  const writable =
    person !== undefined &&
    (item.kind === "overdue_follow_up" || item.kind === "reply_awaiting_response");

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className={s.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={rowCopy(ctx, day).title}
        tabIndex={-1}
      >
        <div className={s.grabber} aria-hidden="true" />
        <div className={s.panelScroll}>
          {person ? (
            <PersonHeader person={person} day={day} />
          ) : (
            <h2 className={s.personName}>{ctx.opportunity?.title}</h2>
          )}
          <div className={s.focus}>
            <span
              className={s.focusKind}
              data-tone={gutter(ctx).tone === "late" ? "late" : undefined}
            >
              {gutter(ctx).text}
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
                  Done
                </button>
                {snooze && (
                  <button type="button" className={s.button} onClick={() => day.snooze(action.id)}>
                    Snooze to {snooze}
                  </button>
                )}
              </div>
            )}
            {draft && <DraftActions draft={draft} day={day} onDone={setToast} />}
          </div>
          {toast && (
            <p className={s.toast} role="status">
              {toast}
            </p>
          )}
          {person && (
            <section className={s.section}>
              <h3 className={s.label}>Thread</h3>
              <Thread person={person} day={day} />
            </section>
          )}
        </div>
        {writable && person && <Composer person={person} ctx={ctx} day={day} onSaved={setToast} />}
      </div>
    </>
  );
}

export function TodayMobile({ snapshot }: SurfaceProps) {
  const day = useDay(snapshot);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = day.contexts.find((c) => c.key === openKey);

  return (
    <div className={`${s.root} ${s.mobile}`}>
      <header className={s.mHead}>
        <h1 className={s.mTitle}>Today</h1>
        <span className={s.headDate}>{shortDay(day.today)}</span>
        <span className={`${s.navCount} ${s.pushRight}`}>{day.contexts.length} open</span>
      </header>
      <div className={s.mScroll}>
        {GROUPS.map(({ tier, label }) => {
          const group = day.contexts.filter((c) => c.item.tier === tier);
          if (group.length === 0) return null;
          return (
            <section key={tier} aria-label={label}>
              <h2 className={s.group}>
                {label} <span className={s.groupCount}>{group.length}</span>
              </h2>
              {group.map((ctx) => {
                const g = gutter(ctx);
                const copy = rowCopy(ctx, day);
                return (
                  <button
                    key={ctx.key}
                    type="button"
                    className={s.mRow}
                    onClick={() => setOpenKey(ctx.key)}
                  >
                    <span className={s.when} data-tone={g.tone}>
                      {g.text}
                    </span>
                    <span className={s.shrink}>
                      <span className={s.rowTitle}>{copy.title}</span>
                      <span className={s.rowSub}>{copy.sub}</span>
                    </span>
                    <Icon.ChevronRight size={14} />
                  </button>
                );
              })}
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
      <nav className={s.mTabs} aria-label="Sections">
        <button type="button" className={s.mTab} aria-current="page">
          <Icon.Sun size={18} />
          Today
        </button>
        {[
          { label: "People", icon: <Icon.People size={18} /> },
          { label: "Outreach", icon: <Icon.Inbox size={18} /> },
          { label: "More", icon: <Icon.Menu size={18} /> },
        ].map((t) => (
          <span
            key={t.label}
            className={s.mTab}
            aria-disabled="true"
            title="Not part of this exploration"
          >
            {t.icon}
            {t.label}
          </span>
        ))}
      </nav>
      {open && <Sheet key={open.key} ctx={open} day={day} onClose={() => setOpenKey(null)} />}
    </div>
  );
}
