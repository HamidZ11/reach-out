import type { Company } from "@/domain/company";
import { CompanySchema } from "@/domain/company";
import type { Draft } from "@/domain/draft";
import { DraftSchema } from "@/domain/draft";
import type { UserId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import { InteractionSchema } from "@/domain/interaction";
import type { NextAction } from "@/domain/next-action";
import { NextActionSchema } from "@/domain/next-action";
import type { Opportunity } from "@/domain/opportunity";
import { OpportunitySchema } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import { PersonSchema } from "@/domain/person";
import type { Interpretation, SourceFact, Subject } from "@/domain/research";
import { InterpretationSchema, SourceFactSchema } from "@/domain/research";
import type { Instant } from "@/domain/time";
import { instant } from "@/domain/time";
import type { Goals, User } from "@/domain/user";
import { UserSchema } from "@/domain/user";
import type { Tables } from "./database.types";

/**
 * Database rows ⇄ domain records. Explicit both ways: rows never leak past the
 * repository, and every row read is parsed by the domain's own schema, so the
 * database can't hand the product a record the domain would reject.
 *
 * Records carry the domain's `userId`: the workspace owner (in V1, the
 * signed-in user, whose personal workspace it is).
 */

/** Timestamps arrive as ISO strings with an offset; the domain stores UTC with Z. */
export function instantOf(value: string): Instant {
  return instant(new Date(value).toISOString());
}

const maybe = <T>(value: T | null): T | undefined => value ?? undefined;
const maybeInstant = (value: string | null) => (value === null ? undefined : instantOf(value));
const stamps = (row: { created_at: string; updated_at: string }) => ({
  createdAt: instantOf(row.created_at),
  updatedAt: instantOf(row.updated_at),
});

/* ——— Rows to records ——— */

export function userFromRow(row: Tables<"profiles">): User {
  return UserSchema.parse({
    id: row.id,
    name: row.name,
    email: row.email,
    timeZone: row.time_zone,
    education:
      row.education_institution === null
        ? undefined
        : {
            institution: row.education_institution,
            course: row.education_course,
            graduationYear: row.education_graduation_year,
          },
    goals:
      row.goal_objective === null
        ? undefined
        : {
            objective: row.goal_objective,
            targetRoles: row.goal_target_roles,
            targetSectors: row.goal_target_sectors,
            targetLocations: row.goal_target_locations,
          },
    onboardingCompletedAt: maybeInstant(row.onboarding_completed_at),
    ...stamps(row),
  });
}

export function companyFromRow(row: Tables<"companies">, userId: UserId): Company {
  return CompanySchema.parse({
    id: row.id,
    userId,
    name: row.name,
    website: maybe(row.website),
    sector: maybe(row.sector),
    location: maybe(row.location),
    notes: maybe(row.notes),
    ...stamps(row),
  });
}

export function personFromRow(row: Tables<"people">, userId: UserId): Person {
  return PersonSchema.parse({
    id: row.id,
    userId,
    name: row.name,
    role: maybe(row.role),
    companyId: maybe(row.company_id),
    source: { kind: row.source_kind, detail: maybe(row.source_detail) },
    email: maybe(row.email),
    linkedinUrl: maybe(row.linkedin_url),
    location: maybe(row.location),
    whyRelevant: maybe(row.why_relevant),
    notes: maybe(row.notes),
    relationshipStatus: row.relationship_status,
    preferredChannel: maybe(row.preferred_channel),
    outreachClosure:
      row.outreach_closed_at === null
        ? undefined
        : { closedAt: instantOf(row.outreach_closed_at), reason: row.outreach_closure_reason },
    ...stamps(row),
  });
}

export type OpportunityRow = Tables<"opportunities"> & {
  opportunity_people: { person_id: string; position: number }[];
};

export function opportunityFromRow(row: OpportunityRow, userId: UserId): Opportunity {
  return OpportunitySchema.parse({
    id: row.id,
    userId,
    title: row.title,
    companyId: row.company_id,
    status: row.status,
    closedReason: maybe(row.closed_reason),
    type: maybe(row.type),
    priority: maybe(row.priority),
    deadline: maybe(row.deadline),
    url: maybe(row.url),
    notes: maybe(row.notes),
    personIds: row.opportunity_people
      .toSorted((a, b) => a.position - b.position)
      .map((link) => link.person_id),
    ...stamps(row),
  });
}

export function interactionFromRow(row: Tables<"interactions">, userId: UserId): Interaction {
  return InteractionSchema.parse({
    id: row.id,
    userId,
    personId: row.person_id,
    opportunityId: maybe(row.opportunity_id),
    kind: row.kind,
    occurredAt: instantOf(row.occurred_at),
    summary: row.summary,
    channel: maybe(row.channel),
    subject: maybe(row.subject),
    body: maybe(row.body),
    format: maybe(row.format),
    ...stamps(row),
  });
}

export function draftFromRow(row: Tables<"drafts">, userId: UserId): Draft {
  return DraftSchema.parse({
    id: row.id,
    userId,
    personId: row.person_id,
    opportunityId: maybe(row.opportunity_id),
    channel: row.channel,
    subject: maybe(row.subject),
    body: row.body,
    origin: row.origin,
    status: row.status,
    approvedAt: maybeInstant(row.approved_at),
    sentAt: maybeInstant(row.sent_at),
    sentInteractionId: maybe(row.sent_interaction_id),
    discardedAt: maybeInstant(row.discarded_at),
    ...stamps(row),
  });
}

export function nextActionFromRow(row: Tables<"next_actions">, userId: UserId): NextAction {
  return NextActionSchema.parse({
    id: row.id,
    userId,
    kind: row.kind,
    title: row.title,
    personId: maybe(row.person_id),
    opportunityId: maybe(row.opportunity_id),
    interactionId: maybe(row.interaction_id),
    dueOn: row.due_on,
    status: row.status,
    completedAt: maybeInstant(row.completed_at),
    dismissedAt: maybeInstant(row.dismissed_at),
    ...stamps(row),
  });
}

type SubjectColumns = {
  subject_type: string;
  person_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
};

function subjectOf(row: SubjectColumns) {
  const id =
    row.subject_type === "person"
      ? row.person_id
      : row.subject_type === "company"
        ? row.company_id
        : row.opportunity_id;
  return { type: row.subject_type, id };
}

/** The column that holds a subject's id, for filtering facts and interpretations. */
export function subjectColumn(subject: Subject): "person_id" | "company_id" | "opportunity_id" {
  return `${subject.type}_id`;
}

export function factFromRow(row: Tables<"source_facts">, userId: UserId): SourceFact {
  return SourceFactSchema.parse({
    id: row.id,
    userId,
    subject: subjectOf(row),
    statement: row.statement,
    provenance: {
      kind: row.provenance_kind,
      url: maybe(row.provenance_url),
      detail: maybe(row.provenance_detail),
    },
    observedOn: maybe(row.observed_on),
    ...stamps(row),
  });
}

export type InterpretationRow = Tables<"interpretations"> & {
  interpretation_facts: { fact_id: string; position: number }[];
};

export function interpretationFromRow(row: InterpretationRow, userId: UserId): Interpretation {
  return InterpretationSchema.parse({
    id: row.id,
    userId,
    subject: subjectOf(row),
    kind: row.kind,
    text: row.text,
    basedOnFactIds: row.interpretation_facts
      .toSorted((a, b) => a.position - b.position)
      .map((link) => link.fact_id),
    generatedBy: { kind: row.generated_by_kind, name: row.generated_by_name },
    generatedAt: instantOf(row.generated_at),
    review: row.review,
    ...stamps(row),
  });
}

/* ——— Records to rows (for writes; the database adds the workspace) ——— */

const orNull = <T>(value: T | undefined): T | null => value ?? null;

export function goalsToRow(goals: Goals | undefined) {
  return goals
    ? {
        objective: goals.objective,
        target_roles: goals.targetRoles,
        target_sectors: goals.targetSectors,
        target_locations: goals.targetLocations,
      }
    : null;
}

export function educationToRow(education: User["education"]) {
  return education
    ? {
        institution: education.institution,
        course: education.course,
        graduation_year: education.graduationYear,
      }
    : null;
}

export function companyToRow(c: Company) {
  return {
    id: c.id,
    name: c.name,
    website: orNull(c.website),
    sector: orNull(c.sector),
    location: orNull(c.location),
    notes: orNull(c.notes),
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function personToRow(p: Person) {
  return {
    id: p.id,
    name: p.name,
    role: orNull(p.role),
    company_id: orNull(p.companyId),
    source_kind: p.source.kind,
    source_detail: orNull(p.source.detail),
    email: orNull(p.email),
    linkedin_url: orNull(p.linkedinUrl),
    location: orNull(p.location),
    why_relevant: orNull(p.whyRelevant),
    notes: orNull(p.notes),
    relationship_status: p.relationshipStatus,
    preferred_channel: orNull(p.preferredChannel),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function opportunityToRow(o: Opportunity) {
  return {
    id: o.id,
    title: o.title,
    company_id: o.companyId,
    status: o.status,
    closed_reason: orNull(o.closedReason),
    type: orNull(o.type),
    priority: orNull(o.priority),
    deadline: orNull(o.deadline),
    url: orNull(o.url),
    notes: orNull(o.notes),
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  };
}

export function opportunityPeopleToRows(o: Opportunity) {
  return o.personIds.map((personId, position) => ({
    opportunity_id: o.id,
    person_id: personId,
    position,
  }));
}

export function nextActionToRow(a: NextAction) {
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    person_id: orNull(a.personId),
    opportunity_id: orNull(a.opportunityId),
    interaction_id: orNull(a.interactionId),
    due_on: a.dueOn,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}
