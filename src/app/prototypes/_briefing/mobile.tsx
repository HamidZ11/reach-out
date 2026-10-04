"use client";

import { useState } from "react";
import { clock, partOfDay, shortDay } from "../_shared/dates";
import type { ItemContext } from "../_shared/snapshot";
import { firstName } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import s from "./briefing.module.css";
import { actionsFor, entryCopy, lede, useEntry } from "./parts";

/** On a phone the briefing leads with one thing, written out in full; the rest fold away. */
function First({ ctx, day }: { ctx: ItemContext; day: Day }) {
  const copy = entryCopy(ctx, day);
  const { run, panelView, notice } = useEntry(ctx, day);
  const [primary, secondary] = actionsFor(ctx, day);
  return (
    <section className={s.mFirst} aria-label="First">
      <span className={s.mKicker} data-late={copy.late || undefined}>
        First · {copy.margin}
      </span>
      <p className={s.mFirstText}>
        <span className={s.lead}>{copy.lead}</span>
        {copy.rest}
      </p>
      {copy.quote && <p className={s.quote}>{copy.quote}</p>}
      {copy.meta && <p className={s.meta}>{copy.meta}</p>}
      <div className={s.mButtons}>
        {primary && (
          <button type="button" className={s.mButton} onClick={() => run(primary.id)}>
            {primary.label}
          </button>
        )}
        {secondary && (
          <button type="button" className={s.mSecondary} onClick={() => run(secondary.id)}>
            {secondary.label.startsWith("Snooze") ? "Later" : secondary.label}
          </button>
        )}
      </div>
      {panelView}
      {notice && (
        <p className={s.notice} role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

function Folded({
  ctx,
  day,
  open,
  onToggle,
}: {
  ctx: ItemContext;
  day: Day;
  open: boolean;
  onToggle: () => void;
}) {
  const copy = entryCopy(ctx, day);
  const { run, panelView, notice } = useEntry(ctx, day);
  const detailId = `briefing-m-${ctx.key}`;
  return (
    <li className={s.mItem}>
      <button
        type="button"
        className={s.mItemButton}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span>
          <span className={s.mKicker} data-late={copy.late || undefined}>
            {copy.margin}
          </span>
          <span className={s.mItemText}>
            <span className={s.lead}>{copy.lead}</span>
            {copy.rest}
          </span>
        </span>
        <span className={s.mChevron} aria-hidden="true">
          ›
        </span>
      </button>
      {open && (
        <div id={detailId} className={s.mDetail}>
          {copy.quote && <p className={s.quote}>{copy.quote}</p>}
          {copy.meta && <p className={s.meta}>{copy.meta}</p>}
          <div className={s.actions}>
            {actionsFor(ctx, day).map((a) => (
              <button
                key={a.id}
                type="button"
                className={a.primary ? `${s.action} ${s.primary}` : s.action}
                onClick={() => run(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
          {panelView}
          {notice && (
            <p className={s.notice} role="status">
              {notice}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function TodayMobile({ snapshot }: SurfaceProps) {
  const day = useDay(snapshot);
  const [open, setOpen] = useState<string | null>(null);
  const [first, ...rest] = day.contexts;

  return (
    <div className={`${s.root} ${s.mobile}`}>
      <header className={s.mHead}>
        <span className={s.wordmark}>Reachout</span>
        <span className={s.mDate}>{shortDay(day.today)}</span>
      </header>
      <main className={s.mBody}>
        <h1 className={s.mGreeting}>
          Good {partOfDay(day.now, day.user.timeZone)}, {firstName(day.user.name)}.
        </h1>
        <p className={s.mLede}>{lede(day.contexts)}</p>

        {first && <First key={first.key} ctx={first} day={day} />}

        {rest.length > 0 && (
          <section className={s.mThen} aria-labelledby="briefing-m-then">
            <h2 id="briefing-m-then" className={s.mKicker}>
              Then
            </h2>
            <ul className={s.mList}>
              {rest.map((ctx) => (
                <Folded
                  key={ctx.key}
                  ctx={ctx}
                  day={day}
                  open={open === ctx.key}
                  onToggle={() => setOpen((o) => (o === ctx.key ? null : ctx.key))}
                />
              ))}
            </ul>
          </section>
        )}

        {day.finished.length > 0 && (
          <ul className={s.done} aria-label="Done today">
            {day.finished.map((f) => (
              <li key={`${f.label}-${f.at}`}>
                <s>{f.label}</s> · {clock(f.at, day.user.timeZone)}
              </li>
            ))}
          </ul>
        )}
      </main>
      <nav className={s.mTabs} aria-label="Sections">
        <button type="button" className={s.mTab} aria-current="page">
          Today
        </button>
        {["People", "Outreach", "More"].map((label) => (
          <span
            key={label}
            className={s.mTab}
            aria-disabled="true"
            title="Not part of this exploration"
          >
            {label}
          </span>
        ))}
      </nav>
    </div>
  );
}
