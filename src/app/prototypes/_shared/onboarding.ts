import { useMemo, useState } from "react";
import { CompanySchema } from "@/domain/company";
import type { NextActionKind } from "@/domain/next-action";
import { NextActionSchema } from "@/domain/next-action";
import { OpportunitySchema } from "@/domain/opportunity";
import type { PersonSource } from "@/domain/person";
import { PersonSchema } from "@/domain/person";
import type { CalendarDate, Instant } from "@/domain/time";
import { addDays } from "@/domain/time";
import { deriveToday } from "@/domain/today";
import type { Objective } from "@/domain/user";
import { firstName, listOf } from "./snapshot";

/**
 * The onboarding flow from PRODUCT.md, shared by every direction so they can
 * be compared on presentation alone. State is local; nothing is saved.
 */

export const STEPS = [
  "objective",
  "roles",
  "sectors",
  "locations",
  "opportunity",
  "person",
  "action",
] as const;
export type StepId = (typeof STEPS)[number];

export const STEP_COPY: Record<StepId, { short: string; question: string; hint: string }> = {
  objective: {
    short: "Goal",
    question: "What are you trying to break into?",
    hint: "Pick the one that matters most right now. You can change it later.",
  },
  roles: {
    short: "Roles",
    question: "Which roles are you aiming for?",
    hint: "Choose any that genuinely fit. You can add your own.",
  },
  sectors: {
    short: "Industries",
    question: "Which industries interest you?",
    hint: "Pick the ones actually in play, not every possibility.",
  },
  locations: {
    short: "Places",
    question: "Where would you work?",
    hint: "Include remote if you would take it.",
  },
  opportunity: {
    short: "Opportunity",
    question: "What's one opportunity you're already looking at?",
    hint: "A posted role, a lab, a team you'd love to join — anything specific.",
  },
  person: {
    short: "Person",
    question: "Who's one person who could help with it?",
    hint: "Someone you've met, found or been pointed to. You don't need their email yet.",
  },
  action: {
    short: "First step",
    question: "What will you do first?",
    hint: "One thing you'll actually do. It goes straight into Today.",
  },
};

export const OBJECTIVE_OPTIONS: {
  value: Objective;
  label: string;
  detail: string;
  phrase: string;
}[] = [
  {
    value: "internship",
    label: "Internship",
    detail: "A summer or placement-year role while you study",
    phrase: "an internship",
  },
  {
    value: "graduate_role",
    label: "Graduate role",
    detail: "A full-time job or graduate scheme once you finish",
    phrase: "a graduate role",
  },
  {
    value: "startup_role",
    label: "Startup role",
    detail: "Joining a small team early, often before a job is posted",
    phrase: "a role at a startup",
  },
  {
    value: "research",
    label: "Research",
    detail: "A lab placement, research assistant post or PhD route",
    phrase: "a research position",
  },
  {
    value: "mentorship",
    label: "Mentorship",
    detail: "Someone experienced to learn from",
    phrase: "a mentor",
  },
  {
    value: "other",
    label: "Something else",
    detail: "You can describe it in Settings",
    phrase: "something new",
  },
];

const CAREER_ROLES = [
  "Software engineering",
  "Backend engineering",
  "Data science",
  "Machine learning",
  "Product management",
  "Quantitative research",
  "Consulting",
  "Investment banking",
];

export const ROLE_OPTIONS: Record<Objective, string[]> = {
  internship: CAREER_ROLES,
  graduate_role: CAREER_ROLES,
  startup_role: [
    "Software engineering",
    "Founding engineer",
    "Product",
    "Design engineering",
    "Growth",
    "Operations",
  ],
  research: ["Summer research placement", "Research assistant", "Research engineer", "PhD"],
  mentorship: [
    "Software engineering",
    "Product",
    "Finance",
    "Consulting",
    "Research",
    "Starting a company",
  ],
  other: CAREER_ROLES,
};

export const SECTOR_OPTIONS = [
  "Fintech",
  "Developer tools",
  "AI and machine learning",
  "Startups",
  "Consulting",
  "Investment banking",
  "Academic research",
  "Climate and energy",
  "Health",
  "Public sector",
];

export const LOCATION_OPTIONS = [
  "London",
  "Manchester",
  "Edinburgh",
  "Cambridge",
  "Bristol",
  "Leeds",
  "Remote (UK)",
  "Abroad",
];

export const SOURCE_OPTIONS: { value: PersonSource["kind"]; label: string }[] = [
  { value: "alumni_network", label: "Alumni network" },
  { value: "event", label: "An event" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "company_website", label: "Their website" },
  { value: "university", label: "My university" },
  { value: "introduction", label: "An introduction" },
  { value: "other", label: "Somewhere else" },
];

export const DUE_OPTIONS = [
  { days: 0, label: "Today" },
  { days: 1, label: "Tomorrow" },
  { days: 3, label: "Later this week" },
] as const;

export type Answers = {
  objective?: Objective;
  roles: string[];
  sectors: string[];
  locations: string[];
  opportunityTitle: string;
  organisation: string;
  deadline: string;
  personName: string;
  personRole: string;
  source?: PersonSource["kind"];
  action?: number;
  due: (typeof DUE_OPTIONS)[number]["days"];
  /** Optional extras captured by C's onboarding; other directions ignore them. */
  opportunityUrl?: string;
  personCompany?: string;
  whyRelevant?: string;
};

const EMPTY: Answers = {
  roles: [],
  sectors: [],
  locations: [],
  opportunityTitle: "",
  organisation: "",
  deadline: "",
  personName: "",
  personRole: "",
  due: 0,
};

type ListField = "roles" | "sectors" | "locations";

export function canContinue(step: StepId, a: Answers): boolean {
  switch (step) {
    case "objective":
      return a.objective !== undefined;
    case "roles":
    case "sectors":
    case "locations":
      return a[step].length > 0;
    case "opportunity":
      return a.opportunityTitle.trim() !== "" && a.organisation.trim() !== "";
    case "person":
      return a.personName.trim() !== "" && a.source !== undefined;
    case "action":
      return a.action !== undefined;
  }
}

/** First-step suggestions written from the user's own answers. */
export function actionSuggestions(a: Answers): { kind: NextActionKind; title: string }[] {
  const person = a.personName.trim();
  const organisation = a.organisation.trim() || "the organisation";
  const title = a.opportunityTitle.trim();
  return [
    ...(person
      ? [{ kind: "reach_out" as const, title: `Introduce yourself to ${firstName(person)}` }]
      : []),
    { kind: "research", title: `Read up on ${organisation} before getting in touch` },
    ...(title ? [{ kind: "apply" as const, title: `Start the ${title} application` }] : []),
  ];
}

/** "an internship in software engineering, across fintech and developer tools, in London or Manchester" */
export function goalPhrase(a: Answers): string {
  const objective = OBJECTIVE_OPTIONS.find((o) => o.value === a.objective);
  if (!objective) return "";
  // Lower-case the first letter for mid-sentence use, but leave acronyms ("AI and …") alone.
  const lower = (xs: string[]) =>
    xs.map((x) => (/^[A-Z][a-z]/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x));
  return [
    objective.phrase,
    a.roles.length ? `in ${listOf(lower(a.roles), "disjunction")}` : "",
    a.sectors.length ? `across ${listOf(lower(a.sectors))}` : "",
    a.locations.length ? `in ${listOf(a.locations, "disjunction")}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * What Today will contain once onboarding finishes, computed by building the
 * records onboarding creates and running the real `deriveToday`.
 */
export function previewToday(
  a: Answers,
  context: { today: CalendarDate; now: Instant; userId: string },
) {
  const suggestion = a.action === undefined ? undefined : actionSuggestions(a)[a.action];
  if (!canContinue("opportunity", a) || !canContinue("person", a) || !suggestion || !a.source) {
    return null;
  }
  const owned = { userId: context.userId, createdAt: context.now, updatedAt: context.now };
  const company = CompanySchema.parse({ id: "onboarding_company", name: a.organisation, ...owned });
  const person = PersonSchema.parse({
    id: "onboarding_person",
    name: a.personName,
    role: a.personRole.trim() || undefined,
    companyId: company.id,
    source: { kind: a.source },
    relationshipStatus: "new",
    ...owned,
  });
  const opportunity = OpportunitySchema.parse({
    id: "onboarding_opportunity",
    title: a.opportunityTitle,
    companyId: company.id,
    status: "identified",
    deadline: a.deadline || undefined,
    personIds: [person.id],
    ...owned,
  });
  const action = NextActionSchema.parse({
    id: "onboarding_action",
    kind: suggestion.kind,
    title: suggestion.title,
    personId: suggestion.kind === "apply" ? undefined : person.id,
    opportunityId: opportunity.id,
    dueOn: addDays(context.today, a.due),
    status: "open",
    ...owned,
  });
  const items = deriveToday({
    today: context.today,
    people: [person],
    opportunities: [opportunity],
    interactions: [],
    drafts: [],
    nextActions: [action],
  });
  return { items, company, person, opportunity, action };
}

export function useOnboarding() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [finished, setFinished] = useState(false);
  const step = STEPS[stepIndex] ?? "objective";

  return useMemo(
    () => ({
      step,
      stepIndex,
      answers,
      finished,
      ready: canContinue(step, answers),
      suggestions: actionSuggestions(answers),
      set: (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch })),
      toggle: (field: ListField, value: string) =>
        setAnswers((a) => ({
          ...a,
          [field]: a[field].includes(value)
            ? a[field].filter((v) => v !== value)
            : [...a[field], value],
        })),
      next: () => {
        if (!canContinue(step, answers)) return;
        if (stepIndex === STEPS.length - 1) setFinished(true);
        else setStepIndex(stepIndex + 1);
      },
      back: () => {
        if (finished) setFinished(false);
        else setStepIndex(Math.max(0, stepIndex - 1));
      },
      goTo: (i: number) => {
        setFinished(false);
        setStepIndex(Math.min(Math.max(0, i), STEPS.length - 1));
      },
      /** Steps up to the first incomplete one can be revisited. */
      reachable: (i: number) => STEPS.slice(0, i).every((s) => canContinue(s, answers)),
      complete: (i: number) => canContinue(STEPS[i] ?? "objective", answers),
    }),
    [step, stepIndex, answers, finished],
  );
}

export type Onboarding = ReturnType<typeof useOnboarding>;
