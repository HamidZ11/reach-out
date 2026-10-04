"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { CalendarDate } from "@/domain/time";
import { addDays, CalendarDateSchema } from "@/domain/time";
import { shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { Answers, Onboarding as Flow, StepId } from "../_shared/onboarding";
import {
  DUE_OPTIONS,
  LOCATION_OPTIONS,
  OBJECTIVE_OPTIONS,
  ROLE_OPTIONS,
  SECTOR_OPTIONS,
  SOURCE_OPTIONS,
  STEP_COPY,
  STEPS,
  useOnboarding,
} from "../_shared/onboarding";
import type { SurfaceId } from "../_shared/options";
import type { Snapshot } from "../_shared/snapshot";
import { firstName } from "../_shared/snapshot";
import type { SurfaceProps } from "../_shared/surface";
import f from "./focus.module.css";
import { TodayMobile } from "./mobile";
import s from "./onboarding.module.css";
import { Avatar, personHandoff, Tile } from "./parts";
import { People } from "./people";
import { Today } from "./today";
import { buildWorkspace, firstSteps, normaliseUrl } from "./workspace";

/**
 * C · Focus onboarding: one decision per step on the same white sheet as the
 * app, with the workspace it creates filling in beside it. Finishing builds
 * real records and opens the approved Today on them.
 */

const COPY: Record<StepId, { question: string; hint: string }> = {
  objective: {
    question: STEP_COPY.objective.question,
    hint: "The one that matters most right now. You can change it later.",
  },
  roles: {
    question: STEP_COPY.roles.question,
    hint: "Choose any that fit. Add your own if it's missing.",
  },
  sectors: {
    question: STEP_COPY.sectors.question,
    hint: "The ones genuinely in play for you, not every possibility.",
  },
  locations: {
    question: "Where would you like to work?",
    hint: "Include remote if you'd take it.",
  },
  opportunity: {
    question: STEP_COPY.opportunity.question,
    hint: "A posted role, a scheme, a lab you'd love to join. Something specific.",
  },
  person: {
    question: "Who could help you with it?",
    hint: "Someone you've met, found or been pointed to. You don't need their email yet.",
  },
  action: {
    question: "What should you do next?",
    hint: "One thing you'll actually do. It will be waiting for you in Today.",
  },
};

const WELCOME = "You're set up. This is your Today.";

type ListField = "roles" | "sectors" | "locations";

const ADD_LABEL: Record<ListField, string> = {
  roles: "Add a role",
  sectors: "Add an industry",
  locations: "Add a place",
};

/* ——— Validation: specific, friendly, shown only once you try to continue ——— */

type Problem = { field: string; message: string };

function problemsFor(step: StepId, a: Answers): Problem[] {
  const problems: Problem[] = [];
  const need = (ok: boolean, field: string, message: string) => {
    if (!ok) problems.push({ field, message });
  };
  switch (step) {
    case "objective":
      need(a.objective !== undefined, "objective", "Choose the one you're aiming for first.");
      break;
    case "roles":
    case "sectors":
    case "locations":
      need(a[step].length > 0, step, "Pick at least one, or add your own.");
      break;
    case "opportunity":
      need(a.opportunityTitle.trim() !== "", "title", "Give it a name, even a rough one.");
      need(a.organisation.trim() !== "", "organisation", "Add who it's with.");
      need(
        !a.opportunityUrl?.trim() || normaliseUrl(a.opportunityUrl) !== undefined,
        "url",
        "That doesn't look like a link. Leave it empty if you don't have one.",
      );
      break;
    case "person":
      need(a.personName.trim() !== "", "name", "Add their name. A first name is fine.");
      need(a.source !== undefined, "source", "Say where you came across them.");
      break;
    case "action":
      need(a.action !== undefined, "action", "Choose one first step.");
      break;
  }
  return problems;
}

/* ——— Pieces ——— */

function Check({ shape }: { shape: "round" | "square" }) {
  return (
    <span className={s.check} data-shape={shape} aria-hidden="true">
      <Icon.Check size={13} weight={2.6} />
    </span>
  );
}

function Message({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className={s.message}>
      <span className={f.dot} data-tone="now" aria-hidden="true" />
      {text}
    </p>
  );
}

function Field({
  id,
  label,
  optional = false,
  problem,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  problem?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
        {optional && <span className={s.optional}>Optional</span>}
      </label>
      {children}
      <Message id={`${id}-problem`} text={problem} />
    </div>
  );
}

/** Props that tie an input to its message, so the problem is read with the field. */
function described(id: string, problem?: string) {
  return problem
    ? { "aria-invalid": true as const, "aria-describedby": `${id}-problem` }
    : { "aria-invalid": undefined, "aria-describedby": undefined };
}

/** A single choice: a whole-row target with a native radio inside it. */
function Choice({
  name,
  checked,
  title,
  detail,
  onChoose,
  onPick,
  compact = false,
}: {
  name: string;
  checked: boolean;
  title: string;
  detail?: string;
  onChoose: () => void;
  /** Every click, including on the choice already made (going back, then forward again). */
  onPick?: () => void;
  compact?: boolean;
}) {
  return (
    <label className={compact ? `${s.option} ${s.compact}` : s.option}>
      <input type="radio" name={name} checked={checked} onChange={onChoose} onClick={onPick} />
      <span className={s.optionText}>
        <span className={s.optionTitle}>{title}</span>
        {detail && <span className={s.optionDetail}>{detail}</span>}
      </span>
      <Check shape="round" />
    </label>
  );
}

function ManyOf({ flow, field, problem }: { flow: Flow; field: ListField; problem?: string }) {
  const [adding, setAdding] = useState(false);
  const [own, setOwn] = useState("");
  const chosen = flow.answers[field];
  const options =
    field === "roles"
      ? ROLE_OPTIONS[flow.answers.objective ?? "internship"]
      : field === "sectors"
        ? SECTOR_OPTIONS
        : LOCATION_OPTIONS;
  const all = [...options, ...chosen.filter((c) => !options.includes(c))];

  const add = () => {
    const value = own.trim();
    const known = all.find((o) => o.toLowerCase() === value.toLowerCase());
    if (known && !chosen.includes(known)) flow.toggle(field, known);
    else if (!known && value) flow.toggle(field, value);
    setOwn("");
  };

  return (
    <div className={s.stack}>
      <div
        className={s.options}
        role="group"
        aria-label={COPY[field].question}
        aria-describedby={problem ? `${field}-problem` : undefined}
        data-field={field}
      >
        {all.map((option) => (
          <button
            key={option}
            type="button"
            className={s.option}
            aria-pressed={chosen.includes(option)}
            onClick={() => flow.toggle(field, option)}
          >
            <span className={s.optionTitle}>{option}</span>
            <Check shape="square" />
          </button>
        ))}
      </div>
      {adding ? (
        <div className={s.addRow}>
          <input
            className={s.input}
            aria-label={ADD_LABEL[field]}
            placeholder="Type it, then press Enter"
            autoFocus
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds what you typed; on an empty field it continues as usual.
              if (e.key !== "Enter" || !own.trim()) return;
              e.preventDefault();
              add();
            }}
          />
          <button type="button" className={f.secondary} onClick={add} disabled={!own.trim()}>
            Add
          </button>
        </div>
      ) : (
        <button type="button" className={s.disclose} onClick={() => setAdding(true)}>
          <Icon.Plus size={15} weight={2} />
          {ADD_LABEL[field]}
        </button>
      )}
      <Message id={`${field}-problem`} text={problem} />
    </div>
  );
}

/* ——— Steps ——— */

function StepBody({
  flow,
  today,
  problems,
  onAutoAdvance,
}: {
  flow: Flow;
  today: CalendarDate;
  problems: Problem[];
  onAutoAdvance: () => void;
}) {
  const a = flow.answers;
  const problem = (field: string) => problems.find((p) => p.field === field)?.message;
  const [moreOpen, setMoreOpen] = useState(Boolean(a.deadline || a.opportunityUrl));
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(a.personRole || a.personCompany !== undefined),
  );
  // Arrow keys move through a radio group by selecting; only a click, tap or
  // Space is a deliberate choice that moves on.
  const roaming = useRef(false);
  const onGroupKey = (e: KeyboardEvent) => {
    roaming.current = e.key.startsWith("Arrow");
  };

  switch (flow.step) {
    case "objective":
      return (
        <>
          <fieldset
            className={s.options}
            data-field="objective"
            aria-describedby={problem("objective") ? "objective-problem" : undefined}
            onKeyDown={onGroupKey}
            onPointerDown={() => {
              roaming.current = false;
            }}
          >
            <legend className="sr-only">{COPY.objective.question}</legend>
            {OBJECTIVE_OPTIONS.map((o) => (
              <Choice
                key={o.value}
                name="objective"
                checked={a.objective === o.value}
                title={o.label}
                detail={o.detail}
                onChoose={() => flow.set({ objective: o.value })}
                onPick={() => {
                  if (roaming.current) roaming.current = false;
                  else onAutoAdvance();
                }}
              />
            ))}
          </fieldset>
          <Message id="objective-problem" text={problem("objective")} />
        </>
      );

    case "roles":
    case "sectors":
    case "locations":
      return <ManyOf key={flow.step} flow={flow} field={flow.step} problem={problem(flow.step)} />;

    case "opportunity":
      return (
        <div className={s.stack}>
          <Field id="ob-title" label="Role or programme" problem={problem("title")}>
            <input
              id="ob-title"
              className={s.input}
              data-field="title"
              data-autofocus
              autoComplete="off"
              placeholder="e.g. Software Engineering Summer Internship"
              value={a.opportunityTitle}
              onChange={(e) => flow.set({ opportunityTitle: e.target.value })}
              {...described("ob-title", problem("title"))}
            />
          </Field>
          <Field id="ob-org" label="Who it's with" problem={problem("organisation")}>
            <input
              id="ob-org"
              className={s.input}
              data-field="organisation"
              autoComplete="organization"
              placeholder="A company, startup, university or lab"
              value={a.organisation}
              onChange={(e) => flow.set({ organisation: e.target.value })}
              {...described("ob-org", problem("organisation"))}
            />
          </Field>
          {moreOpen ? (
            <div className={`${s.pair} ${s.revealed}`}>
              <Field id="ob-deadline" label="Deadline" optional>
                <input
                  id="ob-deadline"
                  type="date"
                  className={s.input}
                  min={today}
                  value={a.deadline}
                  onChange={(e) => flow.set({ deadline: e.target.value })}
                />
              </Field>
              <Field id="ob-url" label="Link to it" optional problem={problem("url")}>
                <input
                  id="ob-url"
                  className={s.input}
                  data-field="url"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="The posting or careers page"
                  value={a.opportunityUrl ?? ""}
                  onChange={(e) => flow.set({ opportunityUrl: e.target.value })}
                  {...described("ob-url", problem("url"))}
                />
              </Field>
            </div>
          ) : (
            <button type="button" className={s.disclose} onClick={() => setMoreOpen(true)}>
              <Icon.Plus size={15} weight={2} />
              Add a deadline or link
            </button>
          )}
        </div>
      );

    case "person": {
      const first = firstName(a.personName.trim());
      return (
        <div className={s.stack}>
          <p className={s.forLine}>
            <Icon.Target size={15} weight={2} />
            <span>
              For <span className={f.oppName}>{a.opportunityTitle.trim()}</span>
              {a.organisation.trim() && ` at ${a.organisation.trim()}`}
            </span>
          </p>
          <Field id="ob-name" label="Their name" problem={problem("name")}>
            <input
              id="ob-name"
              className={s.input}
              data-field="name"
              data-autofocus
              autoComplete="off"
              autoCapitalize="words"
              value={a.personName}
              onChange={(e) => flow.set({ personName: e.target.value })}
              {...described("ob-name", problem("name"))}
            />
          </Field>
          {!detailsOpen && (
            <button
              type="button"
              className={`${s.disclose} ${s.phoneOnly}`}
              onClick={() => {
                setDetailsOpen(true);
                requestAnimationFrame(() => document.getElementById("ob-role")?.focus());
              }}
            >
              <Icon.Plus size={15} weight={2} />
              Add what they do and where
            </button>
          )}
          <div className={s.pair} data-collapsible data-open={detailsOpen || undefined}>
            <Field id="ob-role" label="What they do" optional>
              <input
                id="ob-role"
                className={s.input}
                autoComplete="off"
                placeholder="e.g. Graduate engineer"
                value={a.personRole}
                onChange={(e) => flow.set({ personRole: e.target.value })}
              />
            </Field>
            <Field id="ob-company" label="Where they work" optional>
              <input
                id="ob-company"
                className={s.input}
                autoComplete="off"
                value={a.personCompany ?? a.organisation}
                onChange={(e) => flow.set({ personCompany: e.target.value })}
              />
            </Field>
          </div>
          <fieldset
            className={s.group}
            data-field="source"
            aria-describedby={problem("source") ? "source-problem" : undefined}
          >
            <legend className={s.label}>Where did you come across them?</legend>
            <div className={`${s.options} ${s.sources}`}>
              {SOURCE_OPTIONS.map((o) => (
                <Choice
                  key={o.value}
                  name="source"
                  compact
                  checked={a.source === o.value}
                  title={o.label}
                  onChoose={() => flow.set({ source: o.value })}
                />
              ))}
            </div>
            <Message id="source-problem" text={problem("source")} />
          </fieldset>
          <div className={s.why}>
            <label className={f.whyLabel} htmlFor="ob-why">
              <Icon.Compass size={15} weight={2} />
              {first ? `Why ${first} matters` : "Why they matter"}
              <span className={s.optional}>Optional</span>
            </label>
            <textarea
              id="ob-why"
              className={s.whyInput}
              rows={3}
              placeholder="e.g. Did this internship last year and could tell you what the interviews are really like."
              value={a.whyRelevant ?? ""}
              onChange={(e) => flow.set({ whyRelevant: e.target.value })}
            />
            <p className={s.whyHint}>
              In your own words. You&apos;ll see it whenever they come up.
            </p>
          </div>
        </div>
      );
    }

    case "action":
      return (
        <div className={s.stack}>
          <fieldset
            className={`${s.options} ${s.single}`}
            data-field="action"
            aria-describedby={problem("action") ? "action-problem" : undefined}
          >
            <legend className="sr-only">{COPY.action.question}</legend>
            {firstSteps(a).map((step, i) => (
              <Choice
                key={step.kind}
                name="first-step"
                checked={a.action === i}
                title={step.title}
                detail={step.detail}
                onChoose={() => flow.set({ action: i })}
              />
            ))}
          </fieldset>
          <Message id="action-problem" text={problem("action")} />
          <fieldset className={s.group}>
            <legend className={s.label}>When</legend>
            <div className={s.when}>
              {DUE_OPTIONS.map((o) => (
                <label key={o.days} className={s.whenOption}>
                  <input
                    type="radio"
                    name="due"
                    checked={a.due === o.days}
                    onChange={() => flow.set({ due: o.days })}
                  />
                  <span className={s.whenLabel}>{o.label}</span>
                  <span className={s.whenDate}>{shortDay(addDays(today, o.days))}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      );
  }
}

/* ——— Your workspace, filling in beside the flow (desktop) ——— */

const SLOT_FOR: Record<StepId, "goal" | "opportunity" | "person" | "step"> = {
  objective: "goal",
  roles: "goal",
  sectors: "goal",
  locations: "goal",
  opportunity: "opportunity",
  person: "person",
  action: "step",
};

function Slot({
  id,
  active,
  filled,
  label,
  empty,
  children,
}: {
  id: string;
  active: boolean;
  filled: boolean;
  label: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className={s.slot} data-active={active || undefined} aria-labelledby={id}>
      <h3 id={id} className={s.slotLabel}>
        {label}
      </h3>
      {filled ? children : <p className={s.slotEmpty}>{empty}</p>}
    </section>
  );
}

function Preview({ flow, today }: { flow: Flow; today: CalendarDate }) {
  const a = flow.answers;
  const active = SLOT_FOR[flow.step];
  const goal = OBJECTIVE_OPTIONS.find((o) => o.value === a.objective);
  const targets = [a.roles, a.sectors, a.locations].filter((xs) => xs.length > 0);
  const title = a.opportunityTitle.trim();
  const organisation = a.organisation.trim();
  const deadline = CalendarDateSchema.safeParse(a.deadline).data;
  const name = a.personName.trim();
  const company = (a.personCompany ?? a.organisation).trim();
  const why = a.whyRelevant?.trim();
  const step = a.action === undefined ? undefined : firstSteps(a)[a.action];
  const due = addDays(today, a.due);
  const dueWord = DUE_OPTIONS.find((o) => o.days === a.due)?.label;

  return (
    <aside className={`${s.preview} ${f.scroll}`} aria-label="Your workspace so far">
      <h2 className={s.previewTitle}>Your workspace</h2>
      <p className={s.previewHint}>Fills in as you answer. Today starts from here.</p>

      <Slot
        id="slot-goal"
        active={active === "goal"}
        filled={goal !== undefined}
        label="Aiming for"
        empty="Your goal"
      >
        {goal && (
          <div className={s.slotBody}>
            <span className={s.slotTitle}>{goal.label}</span>
            {targets.map((xs) => (
              <span key={xs.join()} className={s.slotMeta}>
                {xs.join(", ")}
              </span>
            ))}
          </div>
        )}
      </Slot>

      <Slot
        id="slot-opportunity"
        active={active === "opportunity"}
        filled={title !== ""}
        label="Pursuing"
        empty="One opportunity"
      >
        {title && (
          <div className={s.slotRow}>
            {deadline && <Tile small date={deadline} tone={undefined} />}
            <span className={s.slotBody}>
              <span className={`${s.slotTitle} ${f.oppName}`}>{title}</span>
              <span className={s.slotMeta}>
                {[organisation, deadline && `Closes ${shortDay(deadline)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </div>
        )}
      </Slot>

      <Slot
        id="slot-person"
        active={active === "person"}
        filled={name !== ""}
        label="Who can help"
        empty="One person"
      >
        {name && (
          <>
            <div className={s.slotRow}>
              <Avatar name={name} size={36} />
              <span className={s.slotBody}>
                <span className={s.slotName}>{name}</span>
                {(a.personRole.trim() || company) && (
                  <span className={s.slotMeta}>
                    {[a.personRole.trim(), company].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </div>
            {why && (
              <div className={s.slotWhy}>
                <span className={f.whyLabel}>
                  <Icon.Compass size={13} weight={2} />
                  Why {firstName(name)} matters
                </span>
                <p className={s.slotWhyText}>{why}</p>
              </div>
            )}
          </>
        )}
      </Slot>

      <Slot
        id="slot-step"
        active={active === "step"}
        filled={step !== undefined}
        label="First step"
        empty="What you'll do"
      >
        {step && (
          <div className={s.slotRow}>
            <Tile small date={due} tone={a.due === 0 ? "now" : undefined} />
            <span className={s.slotBody}>
              <span className={s.slotTitle}>{step.title}</span>
              <span className={s.slotMeta}>
                {dueWord} · {shortDay(due)}
              </span>
            </span>
          </div>
        )}
      </Slot>
    </aside>
  );
}

/* ——— The flow ——— */

function Setup({
  snapshot,
  frame,
  onDone,
}: {
  snapshot: Snapshot;
  frame: boolean;
  onDone: (answers: Answers) => void;
}) {
  const flow = useOnboarding();
  const [tried, setTried] = useState<StepId | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shown = useRef(flow.step);
  const index = flow.stepIndex;
  const last = index === STEPS.length - 1;
  const typed = flow.step === "opportunity" || flow.step === "person";
  const problems = tried === flow.step ? problemsFor(flow.step, flow.answers) : [];

  useEffect(() => () => clearTimeout(timer.current), []);

  // A new step starts at the top, with focus on its question (or, with a mouse
  // and keyboard, on its first field). Phones don't get the keyboard thrown up.
  useEffect(() => {
    if (shown.current === flow.step) return;
    shown.current = flow.step;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    const fine = window.matchMedia?.("(pointer: fine)").matches ?? false;
    const field = fine ? formRef.current?.querySelector<HTMLElement>("[data-autofocus]") : null;
    (field ?? headingRef.current)?.focus({ preventScroll: true });
  }, [flow.step]);

  // Single choices move on after a beat, so the choice is seen before it goes.
  const autoAdvance = () => {
    clearTimeout(timer.current);
    const from = index;
    timer.current = setTimeout(() => {
      setTried(null);
      flow.goTo(from + 1);
    }, 260);
  };

  const submit = () => {
    clearTimeout(timer.current);
    const found = problemsFor(flow.step, flow.answers);
    if (found.length > 0) {
      setTried(flow.step);
      const field = found[0]?.field;
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>(
            `input[data-field="${field}"], [data-field="${field}"] input, [data-field="${field}"] button`,
          )
          ?.focus();
      });
      return;
    }
    setTried(null);
    if (last) onDone(flow.answers);
    else flow.next();
  };

  const back = () => {
    clearTimeout(timer.current);
    setTried(null);
    flow.back();
  };

  return (
    <div className={`${f.root} ${s.page}${frame ? ` ${s.frame}` : ""}`}>
      <div className={s.shell}>
        <header className={s.top}>
          <span className={s.brand}>
            <span className={s.mark} aria-hidden="true">
              r
            </span>
            Reachout
          </span>
          <button
            type="button"
            className={s.topBack}
            onClick={back}
            disabled={index === 0}
            aria-label="Back"
          >
            <Icon.ArrowLeft size={20} weight={2} />
          </button>
          <div className={s.progress}>
            <div
              className={s.track}
              role="progressbar"
              aria-label="Setup"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={index + 1}
              aria-valuetext={`Step ${index + 1} of ${STEPS.length}: ${STEP_COPY[flow.step].short}`}
            >
              {STEPS.map((id, i) => (
                <span
                  key={id}
                  className={s.segment}
                  data-state={i < index ? "done" : i === index ? "current" : undefined}
                />
              ))}
            </div>
            <span className={s.progressText} aria-hidden="true">
              <span className={s.progressStep}>{STEP_COPY[flow.step].short}</span>
              <span>
                {index + 1} of {STEPS.length}
              </span>
            </span>
          </div>
        </header>

        <div className={s.sheet}>
          <form
            ref={formRef}
            className={s.flow}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div ref={scrollRef} className={`${s.scroller} ${f.scroll}`}>
              <div key={flow.step} className={s.step}>
                <h1 ref={headingRef} className={s.question} tabIndex={-1}>
                  {COPY[flow.step].question}
                </h1>
                <p className={s.hint}>{COPY[flow.step].hint}</p>
                <div className={s.body}>
                  <StepBody
                    flow={flow}
                    today={snapshot.today}
                    problems={problems}
                    onAutoAdvance={autoAdvance}
                  />
                </div>
              </div>
            </div>

            <div className={s.foot}>
              {index > 0 && (
                <button type="button" className={`${f.text} ${s.footBack}`} onClick={back}>
                  <Icon.ArrowLeft size={16} weight={2} />
                  Back
                </button>
              )}
              {typed && (
                <span className={s.footHint} aria-hidden="true">
                  or press <kbd className={f.kbd}>Enter</kbd>
                </span>
              )}
              <button type="submit" className={`${f.primary} ${s.continue}`}>
                {last ? "Open Today" : "Continue"}
                <Icon.ArrowRight size={16} weight={2} />
              </button>
            </div>
          </form>

          <Preview flow={flow} today={snapshot.today} />
        </div>
      </div>
    </div>
  );
}

/* ——— Arrival: the approved Today, already holding what you just set up ——— */

function Arrival({
  workspace,
  frame,
  navigate,
}: {
  workspace: Snapshot;
  frame: boolean;
  navigate: SurfaceProps["navigate"];
}) {
  const [view, setView] = useState<"today" | "people">("today");
  const [welcomed, setWelcomed] = useState(false);

  if (frame) {
    return (
      <div className={s.arrive}>
        <TodayMobile snapshot={workspace} navigate={navigate} welcome={WELCOME} />
      </div>
    );
  }

  // Today and People switch in place, so following a name keeps your new records.
  const go = (surface: SurfaceId) => {
    if (surface !== "today" && surface !== "people") return navigate(surface);
    if (surface === "people" && !workspace.people.some((p) => p.id === personHandoff.id)) {
      personHandoff.id = undefined;
    }
    setWelcomed(true);
    setView(surface);
  };

  return (
    <div className={s.arrive}>
      {view === "people" ? (
        <People snapshot={workspace} navigate={go} />
      ) : (
        <Today snapshot={workspace} navigate={go} welcome={welcomed ? undefined : WELCOME} />
      )}
    </div>
  );
}

function Onboard({ snapshot, navigate, frame }: SurfaceProps & { frame: boolean }) {
  const [workspace, setWorkspace] = useState<Snapshot | null>(null);
  return workspace ? (
    <Arrival workspace={workspace} frame={frame} navigate={navigate} />
  ) : (
    <Setup
      snapshot={snapshot}
      frame={frame}
      onDone={(answers) => setWorkspace(buildWorkspace(answers, snapshot))}
    />
  );
}

export function Onboarding(props: SurfaceProps) {
  return <Onboard {...props} frame={false} />;
}

export function OnboardingMobile(props: SurfaceProps) {
  return <Onboard {...props} frame />;
}
