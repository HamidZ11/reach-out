"use client";

import { useEffect, useState } from "react";
import type { PersonId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import { delta } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import { deadlineText, firstName, RELATIONSHIP_LABEL, STAGE_LABEL } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import {
  Avatar,
  Composer,
  DraftActions,
  gutter,
  Kbd,
  PersonHeader,
  Rail,
  Research,
  rowCopy,
  snoozeLabel,
  Thread,
} from "./parts";
import s from "./triage.module.css";

type Filter = "all" | "attention" | "warm" | "new";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs you" },
  { id: "warm", label: "Warm" },
  { id: "new", label: "Not contacted" },
];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);

const signed = (d: number) => (d === 0 ? "today" : d > 0 ? `+${d}d` : `−${-d}d`);

function Inspector({ person, day }: { person: Person; day: Day }) {
  const [toast, setToast] = useState<string | null>(null);
  const ctx = day.contexts.find((c) => c.person?.id === person.id);
  const next = day.index.openActionsFor(person.id)[0];
  const opportunities = day.index.opportunitiesOf(person.id);
  const snooze = ctx ? snoozeLabel(ctx, day) : undefined;

  return (
    <aside className={s.panel} aria-label={`${person.name}`}>
      <div className={s.panelScroll}>
        <PersonHeader person={person} day={day} />

        {ctx ? (
          <div className={s.focus}>
            <span
              className={s.focusKind}
              data-tone={gutter(ctx).tone === "late" ? "late" : undefined}
            >
              On Today · {gutter(ctx).text}
            </span>
            <p className={s.focusTitle}>{rowCopy(ctx, day).title}</p>
            {ctx.action?.status === "open" && (
              <div className={s.buttons}>
                <button
                  type="button"
                  className={s.button}
                  data-primary=""
                  onClick={() => ctx.action && day.complete(ctx.action.id)}
                >
                  Done
                </button>
                {snooze && (
                  <button
                    type="button"
                    className={s.button}
                    onClick={() => ctx.action && day.snooze(ctx.action.id)}
                  >
                    Snooze to {snooze}
                  </button>
                )}
              </div>
            )}
            {ctx.draft && <DraftActions draft={ctx.draft} day={day} onDone={setToast} />}
          </div>
        ) : next ? (
          <div className={s.focus}>
            <span className={s.focusKind}>Next step · {signed(delta(day.today, next.dueOn))}</span>
            <p className={s.focusTitle}>{next.title}</p>
          </div>
        ) : null}
        {toast && (
          <p className={s.toast} role="status">
            {toast}
          </p>
        )}

        {person.whyRelevant && (
          <section className={s.section}>
            <h3 className={s.label}>Why {firstName(person.name)}</h3>
            <p className={s.why}>{person.whyRelevant}</p>
          </section>
        )}

        <section className={s.section}>
          <h3 className={s.label}>
            <span>Opportunities</span>
            <span className={s.mono}>{opportunities.length}</span>
          </h3>
          {opportunities.length === 0 ? (
            <p className={s.muted}>Not linked to anything yet.</p>
          ) : (
            opportunities.map((o) => (
              <div key={o.id} className={s.oppLine}>
                <span>{o.title}</span>
                <span className={s.oppMeta}>
                  {STAGE_LABEL[o.status].toLowerCase()}
                  {o.deadline ? ` · ${deadlineText(o.deadline, day.today)}` : ""}
                </span>
              </div>
            ))
          )}
        </section>

        <section className={s.section}>
          <h3 className={s.label}>Thread</h3>
          <Thread person={person} day={day} />
        </section>
        <Research person={person} day={day} />
      </div>
      <Composer key={person.id} person={person} day={day} onSaved={setToast} />
    </aside>
  );
}

export function People({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const needsYou = new Set(day.contexts.map((c) => c.person?.id).filter(Boolean));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<PersonId | undefined>(
    () => day.contexts.find((c) => c.person)?.person?.id ?? snapshot.people[0]?.id,
  );

  const q = query.trim().toLowerCase();
  const people = day.records.people.filter((p) => {
    const company = day.index.companyOf(p)?.name ?? "";
    if (q && ![p.name, p.role ?? "", company].some((v) => v.toLowerCase().includes(q)))
      return false;
    if (filter === "attention") return needsYou.has(p.id);
    if (filter === "warm") return p.relationshipStatus === "warm";
    if (filter === "new") return p.relationshipStatus === "new";
    return true;
  });
  const selected = day.index.person(selectedId);
  const index = people.findIndex((p) => p.id === selectedId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const step =
        event.key === "j" || event.key === "ArrowDown"
          ? 1
          : event.key === "k" || event.key === "ArrowUp"
            ? -1
            : 0;
      if (!step) return;
      event.preventDefault();
      const target = people[Math.min(Math.max(index + step, 0), people.length - 1)];
      if (target) setSelectedId(target.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [people, index]);

  return (
    <div className={s.root}>
      <div className={s.app}>
        <Rail active="people" day={day} navigate={navigate} />
        <main className={s.queue}>
          <header className={s.listHead}>
            <h1 className={s.title}>People</h1>
            <span className={s.headDate}>{people.length}</span>
            <div className={s.segments} role="group" aria-label="Filter">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={s.segment}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className={s.search}>
              <Icon.Search size={14} />
              <input
                aria-label="Search people"
                placeholder="Search name, role, company"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </header>
          <div className={s.scroll}>
            {people.length === 0 ? (
              <p className={s.empty}>No one matches. Clear the search or filter.</p>
            ) : (
              <table className={s.table}>
                <colgroup>
                  <col className={s.colPerson} />
                  <col className={s.colCompany} />
                  <col className={s.colRelationship} />
                  <col className={s.colLast} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Company</th>
                    <th scope="col">Relationship</th>
                    <th scope="col">Last</th>
                    <th scope="col">Next</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const last = day.index
                      .historyOf(p.id)
                      .filter((i) => i.kind !== "note")
                      .at(-1);
                    const ctx = day.contexts.find((c) => c.person?.id === p.id);
                    const next = day.index.openActionsFor(p.id)[0];
                    const nextText = ctx ? rowCopy(ctx, day).title : next?.title;
                    const nextWhen = ctx
                      ? gutter(ctx)
                      : next
                        ? { text: signed(delta(day.today, next.dueOn)), tone: undefined }
                        : undefined;
                    return (
                      <tr
                        key={p.id}
                        aria-selected={p.id === selectedId}
                        onClick={() => setSelectedId(p.id)}
                      >
                        <td>
                          <div className={s.nameCell}>
                            <Avatar name={p.name} />
                            <span className={s.shrink}>
                              <button
                                type="button"
                                className={s.cellMain}
                                onClick={() => setSelectedId(p.id)}
                              >
                                {p.name}
                              </button>
                              <span className={s.cellSub}>{p.role}</span>
                            </span>
                          </div>
                        </td>
                        <td>{day.index.companyOf(p)?.name ?? <span className={s.dim}>—</span>}</td>
                        <td className={needsYou.has(p.id) ? undefined : s.dim}>
                          {RELATIONSHIP_LABEL[p.relationshipStatus]}
                        </td>
                        <td className={s.mono}>
                          {last ? (
                            `${day.index.daysSince(last.occurredAt)}d`
                          ) : (
                            <span className={s.dim}>—</span>
                          )}
                        </td>
                        <td>
                          {nextWhen ? (
                            <>
                              <span
                                className={`${s.when} ${s.inlineWhen}`}
                                data-tone={nextWhen.tone}
                              >
                                {nextWhen.text}
                              </span>
                              {nextText}
                            </>
                          ) : (
                            <span className={s.dim}>Nothing planned</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className={`${s.keys} ${s.keysFoot}`} aria-hidden="true">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd> move between people
          </div>
        </main>
        {selected ? (
          <Inspector key={selected.id} person={selected} day={day} />
        ) : (
          <aside className={s.panel} aria-label="Person">
            <p className={s.empty}>Select someone.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
