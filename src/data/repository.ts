import type { Company } from "@/domain/company";
import type {
  ApprovedDraft,
  AwaitingApprovalDraft,
  Draft,
  DraftStatus,
  SentDraft,
} from "@/domain/draft";
import type { DomainErrorCode } from "@/domain/errors";
import type {
  CompanyId,
  DraftId,
  InteractionId,
  NextActionId,
  OpportunityId,
  PersonId,
  UserId,
} from "@/domain/ids";
import type { Interaction, MessageSent } from "@/domain/interaction";
import type {
  DoneNextAction,
  NextAction,
  NextActionStatus,
  OpenNextAction,
} from "@/domain/next-action";
import type { Opportunity } from "@/domain/opportunity";
import type { Person, RelationshipStatus } from "@/domain/person";
import type { Interpretation, SourceFact, Subject } from "@/domain/research";
import type { Instant } from "@/domain/time";
import type { User } from "@/domain/user";

/**
 * The only way product code reads and writes records. A Repository is scoped
 * to one signed-in user (and their workspace) when it is created, so no method
 * takes a userId and no caller can reach another user's records.
 *
 * Implementations: Supabase (production and connected development) and an
 * in-memory one (tests, the explicit seed session, design references).
 * Callers must not be able to tell which one they have.
 *
 * Ordering guarantees (implementations must honour them):
 * - companies, people: by name
 * - opportunities, drafts, source facts: by createdAt
 * - interactions: by occurredAt
 * - next actions: by dueOn
 * - interpretations: by generatedAt
 *
 * Writes persist what a domain rule produced (e.g. `completeNextAction`), and
 * re-check what must never be bypassed: the record is the caller's, nobody
 * changed it since `expected` (its updatedAt when the caller read it), and the
 * transition is allowed. They throw `DomainError` for a broken rule and
 * `RepositoryError` otherwise.
 */
export interface Repository {
  readonly userId: UserId;
  user: {
    get(): Promise<User>;
    /** Settings: name, time zone, education and goals. Email and onboarding are not changed here. */
    save(user: User, expected: Instant): Promise<User>;
  };
  onboarding: {
    /** Onboarding's records, all or nothing, once (DOMAIN.md › Onboarding → records). */
    complete(outcome: OnboardingOutcome): Promise<void>;
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
    get(id: DraftId): Promise<Draft | null>;
    /** A message the user wrote, awaiting approval. */
    create(draft: AwaitingApprovalDraft): Promise<Changed<{ draft: Draft }>>;
    approve(draft: ApprovedDraft, expected: Instant): Promise<Changed<{ draft: Draft }>>;
    /** An edit, which always returns the draft for approval. */
    revise(draft: AwaitingApprovalDraft, expected: Instant): Promise<Changed<{ draft: Draft }>>;
    /** The user sent an approved draft themselves: the sent draft, its message, and the person after it. */
    markSent(sent: MarkedSent, expected: Instant): Promise<Changed<MarkedSentResult>>;
  };
  nextActions: {
    list(filter?: {
      status?: NextActionStatus;
      personId?: PersonId;
      opportunityId?: OpportunityId;
    }): Promise<NextAction[]>;
    get(id: NextActionId): Promise<NextAction | null>;
    complete(
      action: DoneNextAction,
      expected: Instant,
    ): Promise<Changed<{ nextAction: NextAction }>>;
    /** Snooze and reschedule: a new due date, computed by the domain rule. */
    reschedule(
      action: OpenNextAction,
      expected: Instant,
    ): Promise<Changed<{ nextAction: NextAction }>>;
  };
  research: {
    /** Facts about one subject, or every fact when no subject is given. */
    facts(subject?: Subject): Promise<SourceFact[]>;
    /** Interpretations of one subject, or all of them when no subject is given. */
    interpretations(subject?: Subject): Promise<Interpretation[]>;
  };
  /**
   * Puts back exactly what one write changed, if nothing has changed those
   * records since. Each write's `undo` names its step.
   */
  undo(step: UndoStep): Promise<Reverted>;
}

/** Names one write's undo history. Opaque. */
export type UndoStep = string & { readonly __brand: "UndoStep" };

/** A write's result, with the step that can undo it. */
export type Changed<T> = T & { undo: UndoStep };

export type MarkedSent = {
  draft: SentDraft;
  interaction: MessageSent;
  /** The person's status when the caller read it, and after the message (relationshipStatusAfter). */
  relationshipStatus: { before: RelationshipStatus; after: RelationshipStatus };
};

export type MarkedSentResult = { draft: Draft; interaction: Interaction; person: Person };

/** What onboarding creates, built and validated by the domain schemas before it is written. */
export type OnboardingOutcome = {
  /** The user with goals, time zone and onboardingCompletedAt set. */
  user: User;
  companies: Company[];
  people: Person[];
  opportunities: Opportunity[];
  nextActions: NextAction[];
};

/** Records as they were before an undone write. Removed records are named by id. */
export type Reverted = {
  people: Person[];
  drafts: Draft[];
  nextActions: NextAction[];
  removed: { drafts: DraftId[]; interactions: InteractionId[] };
};

export type RepositoryErrorCode =
  /** It doesn't exist, or it isn't the caller's: the same answer either way. */
  | "not_found"
  /** It changed since the caller read it. */
  | "conflict"
  | "onboarding_complete"
  | "undo_unavailable"
  /** The database refused a value the domain should have caught first. */
  | "invalid"
  /** The session is no longer valid. */
  | "unauthenticated"
  /** The data source could not be reached or answered unexpectedly. */
  | "unavailable";

/** A write was refused for a reason other than a domain rule. The code is stable. */
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string = code, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
    this.code = code;
  }
}

/** Codes a write can fail with: a domain rule, or the repository's own. */
export type WriteErrorCode = DomainErrorCode | RepositoryErrorCode;
