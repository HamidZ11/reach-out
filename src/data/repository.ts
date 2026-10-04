import type { Company } from "@/domain/company";
import type { Draft, DraftStatus } from "@/domain/draft";
import type { CompanyId, OpportunityId, PersonId, UserId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import type { NextAction, NextActionStatus } from "@/domain/next-action";
import type { Opportunity } from "@/domain/opportunity";
import type { Person } from "@/domain/person";
import type { Interpretation, SourceFact, Subject } from "@/domain/research";
import type { User } from "@/domain/user";

/**
 * The only way product code reads records. A Repository is scoped to one user
 * when it is created, so no method takes a userId and no caller can forget
 * the ownership filter.
 *
 * Implementations: the seed repository today; Postgres/Supabase later. Callers
 * must not be able to tell which one they have.
 *
 * Ordering guarantees (implementations must honour them):
 * - companies, people: by name
 * - opportunities, drafts, source facts: by createdAt
 * - interactions: by occurredAt
 * - next actions: by dueOn
 * - interpretations: by generatedAt
 *
 * Write methods are added per roadmap phase, alongside the domain operation
 * they persist (e.g. completeNextAction → nextActions.save).
 */
export interface Repository {
  readonly userId: UserId;
  user: {
    get(): Promise<User>;
  };
  companies: {
    list(): Promise<Company[]>;
    get(id: CompanyId): Promise<Company | null>;
  };
  people: {
    list(filter?: { companyId?: CompanyId }): Promise<Person[]>;
    get(id: PersonId): Promise<Person | null>;
  };
  opportunities: {
    list(filter?: { companyId?: CompanyId }): Promise<Opportunity[]>;
    get(id: OpportunityId): Promise<Opportunity | null>;
  };
  interactions: {
    list(filter?: { personId?: PersonId; opportunityId?: OpportunityId }): Promise<Interaction[]>;
  };
  drafts: {
    list(filter?: { status?: DraftStatus; personId?: PersonId }): Promise<Draft[]>;
  };
  nextActions: {
    list(filter?: {
      status?: NextActionStatus;
      personId?: PersonId;
      opportunityId?: OpportunityId;
    }): Promise<NextAction[]>;
  };
  research: {
    facts(subject: Subject): Promise<SourceFact[]>;
    interpretations(subject: Subject): Promise<Interpretation[]>;
  };
}
