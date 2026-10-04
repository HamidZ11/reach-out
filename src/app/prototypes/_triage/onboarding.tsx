"use client";

import { useState } from "react";
import { shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { Onboarding as Flow, StepId } from "../_shared/onboarding";
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
import { capitalise, listOf } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import { Kbd } from "./parts";
import s from "./triage.module.css";

function summary(id: StepId, flow: Flow): string {
  const a = flow.answers;
  switch (id) {
    case "objective":
      return OBJECTIVE_OPTIONS.find((o) => o.value === a.objective)?.label ?? "";
    case "roles":
    case "sectors":
    case "locations":
      return a[id].join(", ");
    case "opportunity":
      return a.opportunityTitle && a.organisation
        ? `${a.opportunityTitle} · ${a.organisation}`
        : "";
    case "person":
      return a.personName;
    case "action":
      return a.action === undefined ? "" : (flow.suggestions[a.action]?.title ?? "");
  }
}

function Checks({
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
  return (
    <>
      <div className={s.grid} role="group" aria-label={STEP_COPY[field].question}>
        {all.map((option) => (
          <button
            key={option}
            type="button"
            className={s.check}
            aria-pressed={chosen.includes(option)}
            onClick={() => flow.toggle(field, option)}
          >
            <span className={s.checkBox} aria-hidden="true">
              {chosen.includes(option) && <Icon.Check size={11} weight={2.4} />}
            </span>
            {option}
          </button>
        ))}
      </div>
      <input
        className={`${s.field} ${s.addField}`}
        aria-label="Add your own"
        placeholder="Add your own and press Enter"
        value={own}
        onChange={(e) => setOwn(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const value = own.trim();
          if (value && !chosen.includes(value)) flow.toggle(field, value);
          setOwn("");
        }}
      />
    </>
  );
}

function StepBody({ flow }: { flow: Flow }) {
  const a = flow.answers;
  switch (flow.step) {
    case "objective":
      return (
        <fieldset className={s.options}>
          <legend className="sr-only">{STEP_COPY.objective.question}</legend>
          {OBJECTIVE_OPTIONS.map((o) => (
            <label key={o.value} className={s.option}>
              <input
                type="radio"
                name="objective"
                checked={a.objective === o.value}
                onChange={() => flow.set({ objective: o.value, roles: [] })}
              />
              <span>
                <span className={s.optionTitle}>{o.label}</span>
                <span className={s.optionDetail}>{o.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      );
    case "roles":
      return (
        <Checks flow={flow} field="roles" options={ROLE_OPTIONS[a.objective ?? "internship"]} />
      );
    case "sectors":
      return <Checks flow={flow} field="sectors" options={SECTOR_OPTIONS} />;
    case "locations":
      return <Checks flow={flow} field="locations" options={LOCATION_OPTIONS} />;
    case "opportunity":
      return (
        <div className={s.fields}>
          <label className={s.fieldLabel}>
            Opportunity
            <input
              className={s.field}
              placeholder="e.g. Software Engineering Summer Internship"
              value={a.opportunityTitle}
              onChange={(e) => flow.set({ opportunityTitle: e.target.value })}
            />
          </label>
          <label className={s.fieldLabel}>
            Organisation
            <input
              className={s.field}
              placeholder="Company, startup, university or lab"
              value={a.organisation}
              onChange={(e) => flow.set({ organisation: e.target.value })}
            />
          </label>
          <label className={s.fieldLabel}>
            Deadline (optional)
            <input
              type="date"
              className={s.field}
              value={a.deadline}
              onChange={(e) => flow.set({ deadline: e.target.value })}
            />
          </label>
        </div>
      );
    case "person":
      return (
        <div className={s.fields}>
          <label className={s.fieldLabel}>
            Name
            <input
              className={s.field}
              value={a.personName}
              onChange={(e) => flow.set({ personName: e.target.value })}
            />
          </label>
          <label className={s.fieldLabel}>
            Role (optional)
            <input
              className={s.field}
              placeholder="e.g. Graduate engineer, recruiter, PhD student"
              value={a.personRole}
              onChange={(e) => flow.set({ personRole: e.target.value })}
            />
          </label>
          <label className={s.fieldLabel}>
            Where you found them
            <select
              className={s.field}
              value={a.source ?? ""}
              onChange={(e) =>
                flow.set({ source: SOURCE_OPTIONS.find((o) => o.value === e.target.value)?.value })
              }
            >
              <option value="">Choose…</option>
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    case "action":
      return (
        <>
          <fieldset className={s.options}>
            <legend className="sr-only">{STEP_COPY.action.question}</legend>
            {flow.suggestions.map((suggestion, i) => (
              <label key={suggestion.title} className={s.option}>
                <input
                  type="radio"
                  name="first-step"
                  checked={a.action === i}
                  onChange={() => flow.set({ action: i })}
                />
                <span className={s.optionTitle}>{suggestion.title}</span>
              </label>
            ))}
          </fieldset>
          <div className={`${s.segments} ${s.whenSegments}`} role="group" aria-label="When">
            {DUE_OPTIONS.map((o) => (
              <button
                key={o.days}
                type="button"
                className={s.segment}
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
  const last = flow.stepIndex === STEPS.length - 1;
  const goal = goalPhrase(flow.answers);
  // The preview is live: it fills in as soon as the answers can build real records.
  const preview = previewToday(flow.answers, {
    today: snapshot.today,
    now: snapshot.now,
    userId: snapshot.user.id,
  });

  return (
    <div className={s.root}>
      <div className={s.onboard}>
        <div className={s.module}>
          <nav className={s.steps} aria-label="Setup steps">
            <div className={s.stepsHead}>Set up Reachout</div>
            {STEPS.map((id, i) => (
              <button
                key={id}
                type="button"
                className={s.step}
                aria-current={!flow.finished && i === flow.stepIndex ? "step" : undefined}
                data-complete={flow.complete(i) || undefined}
                disabled={!flow.reachable(i)}
                onClick={() => flow.goTo(i)}
              >
                <span className={s.stepMark} aria-hidden="true">
                  {flow.complete(i) ? <Icon.Check size={11} weight={2.4} /> : i + 1}
                </span>
                <span>
                  <span className={s.stepLabel}>{STEP_COPY[id].short}</span>
                  <span className={s.stepAnswer}>{summary(id, flow) || "—"}</span>
                </span>
              </button>
            ))}
          </nav>

          {flow.finished ? (
            <div className={s.form}>
              <h1 className={s.question}>Your workspace is ready.</h1>
              <p className={s.hint}>
                Today opens with your first step. Everything else stays editable in Settings.
              </p>
              <div className={s.formFoot}>
                <button type="button" className={s.button} onClick={flow.back}>
                  <Icon.ArrowLeft size={14} /> Review answers
                </button>
                <button
                  type="button"
                  className={s.button}
                  data-primary=""
                  onClick={() => navigate("today")}
                >
                  Open Today
                </button>
              </div>
            </div>
          ) : (
            <form
              className={s.form}
              onSubmit={(e) => {
                e.preventDefault();
                flow.next();
              }}
            >
              <h1 className={s.question}>{STEP_COPY[flow.step].question}</h1>
              <p className={s.hint}>{STEP_COPY[flow.step].hint}</p>
              <StepBody flow={flow} />
              <div className={s.formFoot}>
                <button
                  type="button"
                  className={s.button}
                  onClick={flow.back}
                  disabled={flow.stepIndex === 0}
                >
                  Back
                </button>
                <button type="submit" className={s.button} data-primary="" disabled={!flow.ready}>
                  {last ? "Finish" : "Continue"} <Kbd>↵</Kbd>
                </button>
              </div>
            </form>
          )}

          <aside className={s.preview} aria-label="Workspace preview">
            <div className={s.stepsHead}>Your Today</div>
            <p className={s.previewGoal}>
              {goal ? `${capitalise(goal)}.` : "Your goal will appear here as you answer."}
            </p>
            <div className={s.previewQueue}>
              {preview ? (
                preview.items.map((item) => (
                  <div key={item.kind} className={s.previewRow}>
                    <span
                      className={s.when}
                      data-tone={
                        item.kind === "upcoming_action" && item.daysUntilDue === 0
                          ? "now"
                          : undefined
                      }
                    >
                      {item.kind === "upcoming_action"
                        ? item.daysUntilDue === 0
                          ? "today"
                          : `+${item.daysUntilDue}d`
                        : item.kind === "deadline_approaching"
                          ? `+${item.daysRemaining}d`
                          : ""}
                    </span>
                    <span>
                      {item.kind === "deadline_approaching"
                        ? `${preview.opportunity.title} closes ${shortDay(item.deadline)}`
                        : preview.action.title}
                      <span className={s.cellSub}>
                        {listOf([preview.person.name, preview.company.name])}
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <>
                  <div className={s.ghostRow}>Your first step lands here</div>
                  <div className={s.ghostRow}>Deadlines within a week appear here</div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
