import type { Company } from "@/domain/company";
import { CompanySchema, companyNameKey } from "@/domain/company";
import type { NextActionKind } from "@/domain/next-action";
import { NextActionSchema } from "@/domain/next-action";
import type { OpportunityType } from "@/domain/opportunity";
import { OpportunitySchema } from "@/domain/opportunity";
import { PersonSchema } from "@/domain/person";
import { addDays } from "@/domain/time";
import type { Objective } from "@/domain/user";
import { UserSchema } from "@/domain/user";
import type { Answers } from "../_shared/onboarding";
import type { Snapshot } from "../_shared/snapshot";
import { firstName } from "../_shared/snapshot";

/**
 * Onboarding's outcome as real domain records (DOMAIN.md › Onboarding → records):
 * goals on the user, one company (matched by name), one opportunity, one person
 * linked to it, and one open next action. Built through the domain schemas, so
 * the Today that follows is derived exactly as production will derive it.
 *
 * Prototype only: production saves these through Repository write methods.
 */

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
    {
      kind: "apply",
      title: `Start the application`,
      detail: opportunity,
      withPerson: false,
    },
    {
      kind: "prepare",
      title: `Tailor your CV for this`,
      detail: opportunity,
      withPerson: false,
    },
  ];
}

const TYPE_FOR: Record<Objective, OpportunityType> = {
  internship: "internship",
  graduate_role: "graduate_role",
  startup_role: "startup_role",
  research: "research",
  mentorship: "mentorship",
  other: "other",
};

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

export function buildWorkspace(a: Answers, base: Snapshot): Snapshot {
  const { now, today, user } = base;
  const owned = { userId: user.id, createdAt: now, updatedAt: now };
  const step = a.action === undefined ? undefined : firstSteps(a)[a.action];
  if (!a.objective || !a.source || !step) throw new Error("Onboarding is incomplete");

  const companies: Company[] = [];
  const companyFor = (name: string) => {
    const existing = companies.find((c) => companyNameKey(c.name) === companyNameKey(name));
    if (existing) return existing;
    const company = CompanySchema.parse({
      id: `onboarding_company_${companies.length + 1}`,
      name: name.trim(),
      ...owned,
    });
    companies.push(company);
    return company;
  };

  const opportunityCompany = companyFor(a.organisation);
  const personCompanyName = (a.personCompany ?? a.organisation).trim();
  const personCompany = personCompanyName ? companyFor(personCompanyName) : undefined;

  const person = PersonSchema.parse({
    id: "onboarding_person",
    name: a.personName.trim(),
    role: a.personRole.trim() || undefined,
    companyId: personCompany?.id,
    source: { kind: a.source },
    whyRelevant: a.whyRelevant?.trim() || undefined,
    relationshipStatus: "new",
    ...owned,
  });

  const opportunity = OpportunitySchema.parse({
    id: "onboarding_opportunity",
    title: a.opportunityTitle.trim(),
    companyId: opportunityCompany.id,
    status: "identified",
    type: TYPE_FOR[a.objective],
    deadline: a.deadline || undefined,
    url: normaliseUrl(a.opportunityUrl ?? ""),
    personIds: [person.id],
    ...owned,
  });

  const nextAction = NextActionSchema.parse({
    id: "onboarding_action",
    kind: step.kind,
    title: step.title,
    personId: step.withPerson ? person.id : undefined,
    opportunityId: opportunity.id,
    dueOn: addDays(today, a.due),
    status: "open",
    ...owned,
  });

  return {
    now,
    today,
    user: UserSchema.parse({
      ...user,
      goals: {
        objective: a.objective,
        targetRoles: a.roles,
        targetSectors: a.sectors,
        targetLocations: a.locations,
      },
      onboardingCompletedAt: now,
      updatedAt: now,
    }),
    companies,
    people: [person],
    opportunities: [opportunity],
    interactions: [],
    drafts: [],
    nextActions: [nextAction],
    facts: [],
    interpretations: [],
  };
}
