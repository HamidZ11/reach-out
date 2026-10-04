"use client";

import { useState } from "react";
import type { PersonId } from "@/domain/ids";
import type { Person } from "@/domain/person";
import type { SourceFact } from "@/domain/research";
import { ago, clock, dayMonth, dayOf, delta, shortDay, until } from "../_shared/dates";
import type { ItemContext } from "../_shared/snapshot";
import {
  channelOf,
  deadlineText,
  firstName,
  listOf,
  OUTREACH_LABEL,
  PROVENANCE_LABEL,
  RELATIONSHIP_LABEL,
  sourceText,
  STAGE_LABEL,
} from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import type { Day } from "../_shared/use-day";
import { useDay } from "../_shared/use-day";
import s from "./briefing.module.css";
import { actionsFor, entryCopy, Masthead, useEntry } from "./parts";

type Filter = "all" | "attention" | "warm" | "new";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "attention", label: "Needs you" },
  { id: "warm", label: "Warm" },
  { id: "new", label: "Not contacted" },
];

function AttentionItem({ ctx, day }: { ctx: ItemContext; day: Day }) {
  const entry = useEntry(ctx, day);
  const copy = entryCopy(ctx, day);
  const primary = actionsFor(ctx, day).find((a) => a.primary);
  return (
    <>
      <div className={s.attention}>
        <p className={s.attentionText}>
          <strong>{copy.margin}.</strong> {copy.lead}
          {copy.rest}
        </p>
        {primary && (
          <button
            type="button"
            className={`${s.action} ${s.primary}`}
            onClick={() => entry.run(primary.id)}
          >
            {primary.label} →
          </button>
        )}
      </div>
      {entry.panelView}
      {entry.notice && (
        <p className={s.notice} role="status">
          {entry.notice}
        </p>
      )}
    </>
  );
}

/** What this person needs from you now: their Today item if they have one, else their next step. */
function Attention({ person, day }: { person: Person; day: Day }) {
  const ctx = day.contexts.find((c) => c.person?.id === person.id);
  if (ctx) return <AttentionItem key={ctx.key} ctx={ctx} day={day} />;
  const next = day.index.openActionsFor(person.id)[0];
  return (
    <div className={s.attention} data-calm="">
      <p className={s.attentionText}>
        {next ? (
          <>
            <strong>Next:</strong> {next.title} — {until(delta(day.today, next.dueOn))},{" "}
            {shortDay(next.dueOn)}.
          </>
        ) : (
          <>Nothing scheduled with {firstName(person.name)}.</>
        )}
      </p>
    </div>
  );
}

function Dossier({ person, day }: { person: Person; day: Day }) {
  const company = day.index.companyOf(person);
  const first = firstName(person.name);
  const opportunities = day.index.opportunitiesOf(person.id);
  const history = day.index.historyOf(person.id);
  const lastExchange = history.filter((i) => i.kind !== "note").at(-1);
  const state = day.outreachOf(person.id);

  const personFacts = day.index.factsAbout({ type: "person", id: person.id });
  const companyFacts = company ? day.index.factsAbout({ type: "company", id: company.id }) : [];
  const numbered = new Map<string, number>(
    [...personFacts, ...companyFacts].map((f, i) => [f.id, i + 1]),
  );
  const readings = day.index.interpretationsAbout({ type: "person", id: person.id });

  const standing = [
    RELATIONSHIP_LABEL[person.relationshipStatus],
    OUTREACH_LABEL[state],
    lastExchange
      ? `last contact ${ago(day.index.daysSince(lastExchange.occurredAt))}`
      : "no contact yet",
  ].join(" · ");

  const factList = (facts: SourceFact[]) => (
    <ol className={s.facts}>
      {facts.map((f) => (
        <li key={f.id} className={s.fact}>
          <span className={s.factNumber}>{numbered.get(f.id)}</span>
          <span>
            {f.statement}
            <span className={s.provenance}>
              —{" "}
              {f.provenance.url ? (
                <a href={f.provenance.url} target="_blank" rel="noreferrer">
                  {PROVENANCE_LABEL[f.provenance.kind]}
                </a>
              ) : (
                PROVENANCE_LABEL[f.provenance.kind]
              )}
              {f.provenance.detail ? `, ${f.provenance.detail}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );

  return (
    <article className={s.dossier} aria-labelledby="briefing-person-name">
      <div className={s.dossierSheet}>
        <p className={s.kicker}>
          {[person.role, company?.name, person.location].filter(Boolean).join(" · ")}
        </p>
        <h2 id="briefing-person-name" className={s.name}>
          {person.name}
        </h2>
        <p className={s.standing}>{standing}</p>

        {person.whyRelevant && (
          <div className={s.why}>
            <span className={s.whyLabel}>Why {first} matters</span>
            <p className={s.whyText}>{person.whyRelevant}</p>
          </div>
        )}

        <Attention person={person} day={day} />

        {opportunities.length > 0 && (
          <section className={`${s.block} ${s.row}`}>
            <h3 className={s.blockLabel}>Opportunity</h3>
            <div className={s.blockBody}>
              {opportunities.map((o) => (
                <p key={o.id} className={s.opp}>
                  <span className={s.oppTitle}>{o.title}</span>
                  <span className={s.oppMeta}>
                    {STAGE_LABEL[o.status]}
                    {o.deadline ? ` · ${deadlineText(o.deadline, day.today)}` : ""}
                    {` · with ${
                      listOf(
                        day.index
                          .peopleOf(o)
                          .filter((p) => p.id !== person.id)
                          .map((p) => firstName(p.name)),
                      ) || "nobody else yet"
                    }`}
                  </span>
                </p>
              ))}
            </div>
          </section>
        )}

        <section className={`${s.block} ${s.row}`}>
          <h3 className={s.blockLabel}>What you know</h3>
          <div className={s.blockBody}>
            {personFacts.length === 0 && companyFacts.length === 0 && (
              <p className={`${s.muted} ${s.plain}`}>No facts recorded yet.</p>
            )}
            {personFacts.length > 0 && factList(personFacts)}
            {companyFacts.length > 0 && (
              <>
                <p className={s.subhead}>About {company?.name}</p>
                {factList(companyFacts)}
              </>
            )}
            <span className={s.provenance}>Source: {sourceText(person)}</span>
          </div>
        </section>

        {readings.length > 0 && (
          <section className={`${s.block} ${s.row}`}>
            <h3 className={s.blockLabel}>A reading</h3>
            <div className={s.blockBody}>
              {readings.map((r) => (
                <p key={r.id} className={s.reading}>
                  {r.text}
                  <span className={s.readingNote}>
                    Generated, not a fact · based on{" "}
                    {r.basedOnFactIds.length === 1 ? "fact" : "facts"}{" "}
                    {listOf(r.basedOnFactIds.map((id) => String(numbered.get(id) ?? "?")))} ·{" "}
                    {r.review === "accepted"
                      ? "you kept this"
                      : r.review === "dismissed"
                        ? "you dismissed this"
                        : "not reviewed yet"}
                  </span>
                </p>
              ))}
            </div>
          </section>
        )}

        <section className={`${s.block} ${s.row}`}>
          <h3 className={s.blockLabel}>Your notes</h3>
          <div className={s.blockBody}>
            {person.notes ? (
              <p className={s.plain}>{person.notes}</p>
            ) : (
              <p className={`${s.muted} ${s.plain}`}>No notes yet.</p>
            )}
          </div>
        </section>

        <section className={`${s.block} ${s.row}`}>
          <h3 className={s.blockLabel}>Correspondence</h3>
          <div className={s.blockBody}>
            {history.length === 0 ? (
              <p className={`${s.muted} ${s.plain}`}>
                Nothing yet. {first} hasn&apos;t heard from you.
              </p>
            ) : (
              <ol className={s.transcript}>
                {history.map((i) => {
                  const them = i.kind === "message_received";
                  const who =
                    i.kind === "note"
                      ? "Your note"
                      : i.kind === "meeting"
                        ? `Met · ${channelOf(i)}`
                        : them
                          ? `${first} · ${channelOf(i)}`
                          : `You · ${channelOf(i)}`;
                  return (
                    <li
                      key={i.id}
                      className={s.turn}
                      data-them={them || undefined}
                      data-note={i.kind === "note" || undefined}
                    >
                      <span className={s.turnDate}>
                        {dayMonth(dayOf(i.occurredAt, day.user.timeZone))} ·{" "}
                        {clock(i.occurredAt, day.user.timeZone)}
                      </span>
                      <span>
                        <span className={s.turnWho}>{who}</span>
                        <span className={s.turnText}>{i.summary}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}

export function People({ snapshot, navigate }: SurfaceProps) {
  const day = useDay(snapshot);
  const needsYou = new Set(day.contexts.map((c) => c.person?.id).filter(Boolean));
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<PersonId | undefined>(
    () => day.contexts.find((c) => c.person)?.person?.id ?? snapshot.people[0]?.id,
  );

  const people = day.records.people.filter((p) => {
    if (filter === "attention") return needsYou.has(p.id);
    if (filter === "warm") return p.relationshipStatus === "warm";
    if (filter === "new") return p.relationshipStatus === "new";
    return true;
  });
  const letters = [...new Set(people.map((p) => p.name.charAt(0).toUpperCase()))];
  const selected = day.index.person(selectedId);

  return (
    <div className={s.root}>
      <Masthead active="people" day={day} navigate={navigate} />
      <div className={s.people}>
        <nav className={s.index} aria-label="People">
          <div className={s.indexHead}>
            <h1 className={s.indexTitle}>People</h1>
            <span className={s.indexCount}>{day.records.people.length}</span>
          </div>
          <div className={s.filters}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={s.filter}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {people.length === 0 && <p className={s.empty}>Nobody here yet.</p>}
          {letters.map((letter) => (
            <ul key={letter} className={s.letterGroup} aria-label={letter}>
              <li className={s.letterHead} aria-hidden="true">
                {letter}
              </li>
              {people
                .filter((p) => p.name.charAt(0).toUpperCase() === letter)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={s.personRow}
                      aria-current={p.id === selectedId ? "true" : undefined}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <span className={s.personName}>{p.name}</span>
                      <span className={s.personSub}>
                        {[p.role, day.index.companyOf(p)?.name].filter(Boolean).join(" · ")}
                      </span>
                      <span
                        className={s.personState}
                        data-attention={needsYou.has(p.id) || undefined}
                      >
                        {needsYou.has(p.id)
                          ? "Needs you"
                          : RELATIONSHIP_LABEL[p.relationshipStatus]}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          ))}
        </nav>
        {selected ? (
          <Dossier key={selected.id} person={selected} day={day} />
        ) : (
          <p className={s.empty}>Choose someone to read about them.</p>
        )}
      </div>
    </div>
  );
}
