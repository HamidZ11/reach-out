"use client";

import { addDays } from "@/domain/time";
import { TODAY_RULES } from "@/domain/today";
import { clock, partOfDay, shortDay } from "../_shared/dates";
import type { ItemContext } from "../_shared/snapshot";
import { firstName } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import s from "./briefing.module.css";
import { actionsFor, entryCopy, lede, Masthead, useEntry } from "./parts";

/** Sections follow deriveToday's tiers, so the order is the domain's order. */
const SECTIONS: { tier: number; label: string }[] = [
  { tier: 1, label: "Overdue" },
  { tier: 2, label: "Waiting on you" },
  { tier: 3, label: "Closing soon" },
  { tier: 4, label: "Drafts" },
  { tier: 5, label: "Coming up" },
];

function Entry({ ctx, day }: { ctx: ItemContext; day: Day }) {
  const copy = entryCopy(ctx, day);
  const { run, panelView, notice } = useEntry(ctx, day);
  return (
    <li className={`${s.entry} ${s.row}`}>
      <div className={s.margin} data-late={copy.late || undefined}>
        {copy.margin}
      </div>
      <div>
        <p className={s.sentence}>
          <span className={s.lead}>{copy.lead}</span>
          {copy.rest}
        </p>
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
              {a.primary ? " →" : ""}
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
    </li>
  );
}

/** The next open action beyond Today's window, so the briefing can say what comes after. */
function nextBeyond(day: Day) {
  const horizon = addDays(day.today, TODAY_RULES.upcomingWindowDays);
  const shown = new Set(day.contexts.map((c) => c.action?.id).filter(Boolean));
  return day.records.nextActions
    .filter((a) => a.status === "open" && a.dueOn > horizon && !shown.has(a.id))
    .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
}

export function Today({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const later = nextBeyond(day);
  const greeting = `Good ${partOfDay(day.now, day.user.timeZone)}, ${firstName(day.user.name)}.`;

  return (
    <div className={s.root}>
      <Masthead active="today" day={day} navigate={navigate} />
      <main className={s.page}>
        <div className={s.sheet}>
          <header className={s.row}>
            <p className={s.dateline}>Today</p>
            <div>
              <h1 className={s.greeting}>{greeting}</h1>
              <p className={s.lede}>{lede(day.contexts)}</p>
            </div>
          </header>

          {SECTIONS.map(({ tier, label }) => {
            const entries = day.contexts.filter((c) => c.item.tier === tier);
            if (entries.length === 0) return null;
            return (
              <section key={tier} className={s.section} aria-labelledby={`briefing-tier-${tier}`}>
                <div className={`${s.row} ${s.sectionHead}`}>
                  <h2 id={`briefing-tier-${tier}`} className={s.sectionLabel}>
                    {label}
                  </h2>
                </div>
                <ol className={s.entries}>
                  {entries.map((ctx) => (
                    <Entry key={ctx.key} ctx={ctx} day={day} />
                  ))}
                </ol>
              </section>
            );
          })}

          <footer className={`${s.row} ${s.closing}`}>
            <span />
            <div>
              <p className={s.closingText}>
                {day.contexts.length ? "That's everything for today." : "Nothing needs you today."}
                {later
                  ? ` After this, ${later.title.charAt(0).toLowerCase()}${later.title.slice(1)} on ${shortDay(later.dueOn)}.`
                  : ""}
              </p>
              {day.finished.length > 0 && (
                <ul className={s.done} aria-label="Done today">
                  {day.finished.map((f) => (
                    <li key={`${f.label}-${f.at}`}>
                      <s>{f.label}</s> · {clock(f.at, day.user.timeZone)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
