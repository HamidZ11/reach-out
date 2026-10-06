import type { Route } from "next";
import type { CompanyId, OpportunityId, PersonId } from "@/domain/ids";

/**
 * The V1 information architecture: the product's areas and the question each
 * one answers. This is structure, not navigation design — how (and whether)
 * these appear on screen is decided in the design phase.
 */
export const SECTIONS = {
  onboarding: {
    label: "Onboarding",
    href: "/onboarding",
    question: "What am I trying to get, and who can help?",
  },
  today: {
    label: "Today",
    href: "/today",
    question: "What needs my attention today?",
  },
  people: {
    label: "People",
    href: "/people",
    question: "Who do I know, and where does each relationship stand?",
  },
  opportunities: {
    label: "Opportunities",
    href: "/opportunities",
    question: "What am I pursuing, and how far along is each?",
  },
  outreach: {
    label: "Outreach",
    href: "/outreach",
    question: "What have I drafted, sent and heard back?",
  },
  companies: {
    label: "Companies",
    href: "/companies",
    question: "Who and what do I have at each organisation?",
  },
  settings: {
    label: "Settings",
    href: "/settings",
    question: "What am I aiming for, and how should the product behave?",
  },
} as const satisfies Record<string, { label: string; href: Route; question: string }>;

export type SectionId = keyof typeof SECTIONS;

/** The sections in the main application area, in V1 order. Onboarding sits outside it. */
export const APP_SECTION_IDS = [
  "today",
  "people",
  "opportunities",
  "outreach",
  "companies",
  "settings",
] as const satisfies readonly SectionId[];

/** The query parameter that names the person People shows. It carries an id, never a name. */
export const PERSON_PARAM = "person";

/** Where a person lives: People, with them selected (`/people?person=<id>`). */
export function personHref(id: PersonId): Route {
  return `${SECTIONS.people.href}?${new URLSearchParams({ [PERSON_PARAM]: id })}`;
}

/**
 * Where a person's outreach lives: Outreach, with their track open
 * (`/outreach?person=<id>`). There is one track per person (D-014), so the
 * person's id names it.
 */
export function outreachHref(id: PersonId): Route {
  return `${SECTIONS.outreach.href}?${new URLSearchParams({ [PERSON_PARAM]: id })}`;
}

/** The query parameter that names the opportunity Pursuing shows. An id, never a title. */
export const OPPORTUNITY_PARAM = "opportunity";

/** Where an opportunity lives: Pursuing, with it selected (`/opportunities?opportunity=<id>`). */
export function opportunityHref(id: OpportunityId): Route {
  return `${SECTIONS.opportunities.href}?${new URLSearchParams({ [OPPORTUNITY_PARAM]: id })}`;
}

/** The query parameter that names the company Companies shows. An id, never a name. */
export const COMPANY_PARAM = "company";

/** On Companies: the opportunity a phone came from, so Back can return to it. */
export const FROM_PARAM = "from";

/** Where a company lives (`/companies?company=<id>`), optionally with the opportunity it was opened from. */
export function companyHref(id: CompanyId, from?: OpportunityId): Route {
  const params = new URLSearchParams({ [COMPANY_PARAM]: id });
  if (from) params.set(FROM_PARAM, from);
  return `${SECTIONS.companies.href}?${params}`;
}
