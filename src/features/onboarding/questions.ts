import type { NextActionKind } from "@/domain/next-action";
import type { PersonSource } from "@/domain/person";
import type { Objective } from "@/domain/user";
import { firstName } from "@/features/workspace/records";

/**
 * The onboarding flow from PRODUCT.md › Onboarding: one question per step,
 * asked in this order. Seven steps, no more (DESIGN.md › Onboarding).
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

/** Each step's question, its hint, and its short name in the progress bar. */
export const COPY: Record<StepId, { short: string; question: string; hint: string }> = {
  objective: {
    short: "Goal",
    question: "What are you trying to break into?",
    hint: "The one that matters most right now. You can change it later.",
  },
  roles: {
    short: "Roles",
    question: "Which roles are you aiming for?",
    hint: "Choose any that fit. Add your own if it's missing.",
  },
  sectors: {
    short: "Industries",
    question: "Which industries interest you?",
    hint: "The ones genuinely in play for you, not every possibility.",
  },
  locations: {
    short: "Places",
    question: "Where would you like to work?",
    hint: "Include remote if you'd take it.",
  },
  opportunity: {
    short: "Opportunity",
    question: "What's one opportunity you're already looking at?",
    hint: "A posted role, a scheme, a lab you'd love to join. Something specific.",
  },
  person: {
    short: "Person",
    question: "Who could help you with it?",
    hint: "Someone you've met, found or been pointed to. You don't need their email yet.",
  },
  action: {
    short: "First step",
    question: "What should you do next?",
    hint: "One thing you'll actually do. It will be waiting for you in Today.",
  },
};

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
  opportunityUrl?: string;
  personName: string;
  personRole: string;
  personCompany?: string;
  source?: PersonSource["kind"];
  whyRelevant?: string;
  action?: number;
  due: (typeof DUE_OPTIONS)[number]["days"];
};

export const EMPTY: Answers = {
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

export type FirstStep = {
  kind: NextActionKind;
  title: string;
  detail: string;
  withPerson: boolean;
};

/** First-step choices, written from the user's own answers. */
export function firstSteps(a: Answers): FirstStep[] {
  const first = firstName(a.personName.trim()) || "them";
  const opportunity = a.opportunityTitle.trim() || "this opportunity";
  return [
    {
      kind: "reach_out",
      title: `Send ${first} a message`,
      detail: "Introduce yourself and ask one specific question",
      withPerson: true,
    },
    {
      kind: "research",
      title: `Read up on ${first} first`,
      detail: "Their profile and recent work, before you write",
      withPerson: true,
    },
    {
      kind: "follow_up",
      title: `Follow up with ${first}`,
      detail: "If you've already been in touch",
      withPerson: true,
    },
    { kind: "apply", title: "Start the application", detail: opportunity, withPerson: false },
    { kind: "prepare", title: "Tailor your CV for this", detail: opportunity, withPerson: false },
  ];
}

/** Accepts "ledgerline.com/careers" as well as full URLs. Undefined when not a link. */
export function normaliseUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/* ——— Validation: specific, friendly, shown only once you try to continue ——— */

export type Problem = { field: string; message: string };

export function problemsFor(step: StepId, a: Answers): Problem[] {
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
