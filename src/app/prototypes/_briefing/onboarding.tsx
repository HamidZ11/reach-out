"use client";

import { useState } from "react";
import { dayCount, shortDay, weekday } from "../_shared/dates";
import type { Onboarding as Flow } from "../_shared/onboarding";
import {
  DUE_OPTIONS,
  goalPhrase,
  LOCATION_OPTIONS,
  OBJECTIVE_OPTIONS,
  previewToday,
  ROLE_OPTIONS,
  SECTOR_OPTIONS,
  SOURCE_OPTIONS,
  STEP_COPY,
  STEPS,
  useOnboarding,
} from "../_shared/onboarding";
import type { SurfaceProps } from "../_shared/surface";
import s from "./briefing.module.css";

const width = (value: string, placeholder: string) =>
  Math.max(value.length, placeholder.length) + 1;

/** Multi-select as typeset words, with room to add your own. */
function Words({
  flow,
  field,
  options,
}: {
  flow: Flow;
  field: "roles" | "sectors" | "locations";
  options: string[];
}) {
  const [own, setOwn] = useState("");
  const chosen = flow.answers[field];
  const all = [...options, ...chosen.filter((c) => !options.includes(c))];
  const add = () => {
    const value = own.trim();
    if (value && !chosen.includes(value)) flow.toggle(field, value);
    setOwn("");
  };
  return (
    <>
      <div className={s.words} role="group" aria-label={STEP_COPY[field].question}>
        {all.map((option) => (
          <button
            key={option}
            type="button"
            className={s.word}
            aria-pressed={chosen.includes(option)}
            onClick={() => flow.toggle(field, option)}
          >
            {option}
          </button>
        ))}
      </div>
      <label className={s.addOwn}>
        Or add your own
        <input
          className={s.inlineInput}
          value={own}
          placeholder="type and press Enter"
          size={width(own, "type and press Enter")}
          onChange={(e) => setOwn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      </label>
    </>
  );
}

function Blank({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className={s.inlineInput}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      size={width(value, placeholder)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function StepBody({ flow }: { flow: Flow }) {
  const a = flow.answers;
  switch (flow.step) {
    case "objective":
      return (
        <fieldset className={s.choices}>
          <legend className="sr-only">{STEP_COPY.objective.question}</legend>
          {OBJECTIVE_OPTIONS.map((o) => (
            <label key={o.value} className={s.choice}>
              <input
                type="radio"
                name="objective"
                checked={a.objective === o.value}
                onChange={() => flow.set({ objective: o.value, roles: [] })}
              />
              <span className={s.choiceMark} aria-hidden="true">
                —
              </span>
              <span>
                <span className={s.choiceTitle}>{o.label}</span>
                <span className={s.choiceDetail}>{o.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      );
    case "roles":
      return (
        <Words flow={flow} field="roles" options={ROLE_OPTIONS[a.objective ?? "internship"]} />
      );
    case "sectors":
      return <Words flow={flow} field="sectors" options={SECTOR_OPTIONS} />;
    case "locations":
      return <Words flow={flow} field="locations" options={LOCATION_OPTIONS} />;
    case "opportunity":
      return (
        <>
          <p className={s.madlib}>
            I&apos;m looking at{" "}
            <Blank
              label="Opportunity"
              placeholder="the role or programme"
              value={a.opportunityTitle}
              onChange={(v) => flow.set({ opportunityTitle: v })}
            />{" "}
            at{" "}
            <Blank
              label="Organisation"
              placeholder="which organisation"
              value={a.organisation}
              onChange={(v) => flow.set({ organisation: v })}
            />
            , and it closes on{" "}
            <input
              type="date"
              className={s.inlineInput}
              aria-label="Deadline (optional)"
              value={a.deadline}
              onChange={(e) => flow.set({ deadline: e.target.value })}
            />
            .
          </p>
          <p className={s.hint}>Leave the date blank if there isn&apos;t one.</p>
        </>
      );
    case "person":
      return (
        <p className={s.madlib}>
          Someone who could help is{" "}
          <Blank
            label="Their name"
            placeholder="their name"
            value={a.personName}
            onChange={(v) => flow.set({ personName: v })}
          />
          ,{" "}
          <Blank
            label="Their role (optional)"
            placeholder="their role"
            value={a.personRole}
            onChange={(v) => flow.set({ personRole: v })}
          />
          , and I found them through{" "}
          <select
            className={s.inlineInput}
            aria-label="Where you found them"
            value={a.source ?? ""}
            onChange={(e) =>
              flow.set({ source: SOURCE_OPTIONS.find((o) => o.value === e.target.value)?.value })
            }
          >
            <option value="">choose…</option>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label.toLowerCase()}
              </option>
            ))}
          </select>
          .
        </p>
      );
    case "action":
      return (
        <>
          <fieldset className={s.choices}>
            <legend className="sr-only">{STEP_COPY.action.question}</legend>
            {flow.suggestions.map((suggestion, i) => (
              <label key={suggestion.title} className={s.choice}>
                <input
                  type="radio"
                  name="first-step"
                  checked={a.action === i}
                  onChange={() => flow.set({ action: i })}
                />
                <span className={s.choiceMark} aria-hidden="true">
                  —
                </span>
                <span className={s.choiceTitle}>{suggestion.title}</span>
              </label>
            ))}
          </fieldset>
          <div className={s.when} role="group" aria-label="When">
            <span>When</span>
            {DUE_OPTIONS.map((o) => (
              <button
                key={o.days}
                type="button"
                className={s.whenOption}
                aria-pressed={a.due === o.days}
                onClick={() => flow.set({ due: o.days })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      );
  }
}

export function Onboarding({ snapshot, navigate }: SurfaceProps) {
  const flow = useOnboarding();
  const phrase = goalPhrase(flow.answers);
  const last = flow.stepIndex === STEPS.length - 1;
  const preview = flow.finished
    ? previewToday(flow.answers, {
        today: snapshot.today,
        now: snapshot.now,
        userId: snapshot.user.id,
      })
    : null;

  return (
    <div className={`${s.root} ${s.onboard}`}>
      <header className={s.onboardTop}>
        <span className={s.wordmark}>Reachout</span>
        <div className={s.progress} aria-hidden="true">
          {STEPS.map((id, i) => (
            <span
              key={id}
              className={s.tick}
              data-done={flow.finished || i < flow.stepIndex || undefined}
              data-current={(!flow.finished && i === flow.stepIndex) || undefined}
            />
          ))}
        </div>
        <span className={s.stepCount}>
          {flow.finished ? "Ready" : `${flow.stepIndex + 1} of ${STEPS.length}`}
        </span>
      </header>

      <main className={s.onboardMain}>
        {preview ? (
          <>
            <h1 className={s.question}>Your first briefing is ready.</h1>
            <p className={s.hint}>
              You&apos;re looking for {phrase}. This is what Today will open with.
            </p>
            <ol className={`${s.entries} ${s.preview}`}>
              {preview.items.map((item) => (
                <li key={item.kind} className={`${s.entry} ${s.row}`}>
                  <span className={s.margin}>
                    {item.kind === "upcoming_action"
                      ? item.daysUntilDue === 0
                        ? "Today"
                        : item.daysUntilDue === 1
                          ? "Tomorrow"
                          : shortDay(item.dueOn)
                      : item.kind === "deadline_approaching"
                        ? `${dayCount(item.daysRemaining)} left`
                        : ""}
                  </span>
                  <p className={s.sentence}>
                    {item.kind === "deadline_approaching" ? (
                      <>
                        <span className={s.lead}>{preview.opportunity.title}</span> at{" "}
                        {preview.company.name} closes on {weekday(item.deadline)}.
                      </>
                    ) : (
                      <>
                        <span className={s.lead}>{preview.action.title}</span>.
                        <span className={s.metaLine}>
                          {preview.person.name} · {preview.opportunity.title}
                        </span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
            <div className={s.onboardFoot}>
              <button type="button" className={s.ghost} onClick={flow.back}>
                ← Change an answer
              </button>
              <button type="button" className={s.button} onClick={() => navigate("today")}>
                Open Today
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              flow.next();
            }}
          >
            <h1 className={s.question}>{STEP_COPY[flow.step].question}</h1>
            <p className={s.hint}>{STEP_COPY[flow.step].hint}</p>
            <StepBody flow={flow} />
            <div className={s.onboardFoot}>
              <button
                type="button"
                className={s.ghost}
                onClick={flow.back}
                disabled={flow.stepIndex === 0}
              >
                {flow.stepIndex === 0 ? "" : "← Back"}
              </button>
              <button type="submit" className={s.button} disabled={!flow.ready}>
                {last ? "Build my Today" : "Continue"}
              </button>
            </div>
          </form>
        )}
      </main>

      {phrase && !preview ? (
        <aside className={s.composed} aria-live="polite">
          <span className={s.composedLabel}>So far</span>
          <p className={s.composedText}>You&apos;re looking for {phrase}.</p>
        </aside>
      ) : (
        <span />
      )}
    </div>
  );
}
