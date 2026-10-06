import type { Company } from "@/domain/company";
import { CompanySchema, companyNameKey } from "@/domain/company";
import { NextActionSchema } from "@/domain/next-action";
import type { OpportunityType } from "@/domain/opportunity";
import { OpportunitySchema } from "@/domain/opportunity";
import { PersonSchema } from "@/domain/person";
import { addDays } from "@/domain/time";
import type { Objective } from "@/domain/user";
import { UserSchema } from "@/domain/user";
import type { Workspace } from "@/features/workspace/records";
import type { Answers } from "./questions";
import { firstSteps, normaliseUrl } from "./questions";

/** What onboarding starts from: the signed-in user and the clock, read on the server. */
export type OnboardingBase = Pick<Workspace, "now" | "today" | "user">;

const TYPE_FOR: Record<Objective, OpportunityType> = {
  internship: "internship",
  graduate_role: "graduate_role",
  startup_role: "startup_role",
  research: "research",
  mentorship: "mentorship",
  other: "other",
};

/**
 * Onboarding's outcome as real domain records (DOMAIN.md › Onboarding →
 * records): goals on the user, one company per organisation (matched by name
 * key), one opportunity, one person linked to it, and one open next action.
 * Every record goes through the domain schemas, so the Today that follows is
 * derived exactly as it will be once these are saved.
 *
 * NOT SAVED. Until the Repository gains writes (ROADMAP phase 2, with accounts
 * in phase 6), the result lives for this session only.
 */
export function buildWorkspace(a: Answers, base: OnboardingBase): Workspace {
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
