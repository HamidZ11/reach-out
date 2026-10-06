import type { Draft } from "@/domain/draft";
import { DomainError } from "@/domain/errors";
import type { UserId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import type { NextAction } from "@/domain/next-action";
import type { Person } from "@/domain/person";
import type { RecordSet } from "@/domain/records";
import { findIntegrityViolations } from "@/domain/records";
import { sameSubject } from "@/domain/research";
import type { Instant } from "@/domain/time";
import { compareInstants } from "@/domain/time";
import { UserSchema } from "@/domain/user";
import type { Repository, Reverted, UndoStep } from "../repository";
import { RepositoryError } from "../repository";

/**
 * An in-memory Repository over a validated RecordSet: tests, design
 * references, and the explicit development seed session. NOT DURABLE: it
 * lives as long as the object does.
 *
 * Writes follow the same contract as the Supabase repository's database
 * functions: the record must be the user's, unchanged since `expected`, and
 * in a state the transition allows. Reads return copies.
 */
export function createMemoryRepository(records: RecordSet, userId: UserId): Repository {
  const violations = findIntegrityViolations(records);
  if (violations.length > 0) {
    throw new Error(`Records are inconsistent:\n- ${violations.join("\n- ")}`);
  }
  if (!records.users.some((u) => u.id === userId)) throw new Error(`No user ${userId} in records`);

  const store: RecordSet = structuredClone(records);
  const steps = new Map<string, Step>();

  const own = <T extends { userId: UserId }>(items: readonly T[]) =>
    items.filter((item) => item.userId === userId);
  const result = <T>(value: T): Promise<T> => Promise.resolve(structuredClone(value));
  const findOwn = <T extends { id: string; userId: UserId }>(items: readonly T[], id: string) =>
    own(items).find((item) => item.id === id);
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "en-GB");
  const byCreated = (a: { createdAt: string }, b: { createdAt: string }) =>
    Date.parse(a.createdAt) - Date.parse(b.createdAt);
  const user = () => {
    const found = store.users.find((u) => u.id === userId);
    if (!found) throw new RepositoryError("not_found");
    return found;
  };

  /** The record as the caller last read it, or why it can't be changed. */
  function current<T extends { id: string; userId: UserId; updatedAt: Instant }>(
    items: readonly T[],
    id: string,
    expected: Instant,
  ): T {
    const found = findOwn(items, id);
    if (!found) throw new RepositoryError("not_found");
    if (compareInstants(found.updatedAt, expected) !== 0) throw new RepositoryError("conflict");
    return found;
  }

  function replace<K extends "people" | "drafts" | "nextActions">(
    kind: K,
    next: RecordSet[K][number],
  ) {
    const list = store[kind] as RecordSet[K][number][];
    const index = list.findIndex((item) => item.id === next.id);
    list[index] = structuredClone(next);
  }

  function remember(step: Step): UndoStep {
    const id = crypto.randomUUID() as UndoStep;
    steps.set(id, step);
    return id;
  }

  return {
    userId,
    user: {
      get: () => result(user()),
      async save(next, expected) {
        const stored = user();
        if (compareInstants(stored.updatedAt, expected) !== 0)
          throw new RepositoryError("conflict");
        // Email is the sign-in address and onboarding is onboarding's: neither changes here.
        const saved = UserSchema.parse({
          ...stored,
          name: next.name,
          timeZone: next.timeZone,
          education: next.education,
          goals: next.goals,
          updatedAt: next.updatedAt,
        });
        store.users = store.users.map((u) => (u.id === userId ? saved : u));
        return result(saved);
      },
    },
    onboarding: {
      async complete(outcome) {
        if (user().onboardingCompletedAt !== undefined) {
          throw new RepositoryError("onboarding_complete");
        }
        const next: RecordSet = {
          ...store,
          users: store.users.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  timeZone: outcome.user.timeZone,
                  goals: outcome.user.goals,
                  onboardingCompletedAt: outcome.user.onboardingCompletedAt,
                  updatedAt: outcome.user.updatedAt,
                }
              : u,
          ),
          companies: [...store.companies, ...outcome.companies],
          people: [...store.people, ...outcome.people],
          opportunities: [...store.opportunities, ...outcome.opportunities],
          nextActions: [...store.nextActions, ...outcome.nextActions],
        };
        const problems = findIntegrityViolations(next);
        if (problems.length > 0) throw new RepositoryError("conflict", problems.join("; "));
        Object.assign(store, structuredClone(next));
      },
    },
    companies: {
      list: () => result(own(store.companies).toSorted(byName)),
      get: (id) => result(findOwn(store.companies, id) ?? null),
    },
    people: {
      list: (filter = {}) =>
        result(
          own(store.people)
            .filter((p) => filter.companyId === undefined || p.companyId === filter.companyId)
            .toSorted(byName),
        ),
      get: (id) => result(findOwn(store.people, id) ?? null),
    },
    opportunities: {
      list: (filter = {}) =>
        result(
          own(store.opportunities)
            .filter((o) => filter.companyId === undefined || o.companyId === filter.companyId)
            .toSorted(byCreated),
        ),
      get: (id) => result(findOwn(store.opportunities, id) ?? null),
    },
    interactions: {
      list: (filter = {}) =>
        result(
          own(store.interactions)
            .filter((i) => filter.personId === undefined || i.personId === filter.personId)
            .filter(
              (i) => filter.opportunityId === undefined || i.opportunityId === filter.opportunityId,
            )
            .toSorted((a, b) => compareInstants(a.occurredAt, b.occurredAt)),
        ),
    },
    drafts: {
      list: (filter = {}) =>
        result(
          own(store.drafts)
            .filter((d) => filter.status === undefined || d.status === filter.status)
            .filter((d) => filter.personId === undefined || d.personId === filter.personId)
            .toSorted(byCreated),
        ),
      get: (id) => result(findOwn(store.drafts, id) ?? null),
      async create(draft) {
        if (!findOwn(store.people, draft.personId)) throw new RepositoryError("not_found");
        if (draft.opportunityId && !findOwn(store.opportunities, draft.opportunityId)) {
          throw new RepositoryError("not_found");
        }
        const created: Draft = { ...draft, userId, status: "awaiting_approval", origin: "user" };
        store.drafts.push(structuredClone(created));
        const undo = remember({
          updated: [],
          created: [{ kind: "drafts", id: created.id, after: created.updatedAt }],
        });
        return { ...(await result({ draft: created })), undo };
      },
      async approve(draft, expected) {
        const before = current(store.drafts, draft.id, expected);
        if (before.status !== "awaiting_approval") {
          throw new DomainError(
            "draft_not_awaiting_approval",
            `Draft ${draft.id} is ${before.status}`,
          );
        }
        replace("drafts", draft);
        const undo = remember({
          updated: [{ kind: "drafts", before, after: draft.updatedAt }],
          created: [],
        });
        return { ...(await result({ draft })), undo };
      },
      async revise(draft, expected) {
        const before = current(store.drafts, draft.id, expected);
        if (before.status !== "awaiting_approval" && before.status !== "approved") {
          throw new DomainError("draft_not_editable", `Draft ${draft.id} is ${before.status}`);
        }
        replace("drafts", draft);
        const undo = remember({
          updated: [{ kind: "drafts", before, after: draft.updatedAt }],
          created: [],
        });
        return { ...(await result({ draft })), undo };
      },
      async markSent({ draft, interaction, relationshipStatus }, expected) {
        const before = current(store.drafts, draft.id, expected);
        if (before.status !== "approved") {
          throw new DomainError("draft_not_approved", `Draft ${draft.id} is ${before.status}`);
        }
        const person = findOwn(store.people, before.personId);
        if (!person) throw new RepositoryError("not_found");
        if (person.relationshipStatus !== relationshipStatus.before) {
          throw new RepositoryError("conflict");
        }
        const updated: Step["updated"] = [{ kind: "drafts", before, after: draft.updatedAt }];
        store.interactions.push(structuredClone(interaction));
        replace("drafts", draft);
        let after: Person = person;
        if (relationshipStatus.after !== person.relationshipStatus) {
          after = {
            ...person,
            relationshipStatus: relationshipStatus.after,
            updatedAt: draft.updatedAt,
          };
          updated.push({ kind: "people", before: person, after: after.updatedAt });
          replace("people", after);
        }
        const undo = remember({
          updated,
          created: [{ kind: "interactions", id: interaction.id, after: interaction.updatedAt }],
        });
        return { ...(await result({ draft, interaction, person: after })), undo };
      },
    },
    nextActions: {
      list: (filter = {}) =>
        result(
          own(store.nextActions)
            .filter((a) => filter.status === undefined || a.status === filter.status)
            .filter((a) => filter.personId === undefined || a.personId === filter.personId)
            .filter(
              (a) => filter.opportunityId === undefined || a.opportunityId === filter.opportunityId,
            )
            .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn)),
        ),
      get: (id) => result(findOwn(store.nextActions, id) ?? null),
      async complete(action, expected) {
        const before = current(store.nextActions, action.id, expected);
        if (before.status !== "open") {
          throw new DomainError(
            "next_action_not_open",
            `Next action ${action.id} is ${before.status}`,
          );
        }
        replace("nextActions", action);
        const undo = remember({
          updated: [{ kind: "nextActions", before, after: action.updatedAt }],
          created: [],
        });
        return { ...(await result({ nextAction: action as NextAction })), undo };
      },
      async reschedule(action, expected) {
        const before = current(store.nextActions, action.id, expected);
        if (before.status !== "open") {
          throw new DomainError(
            "next_action_not_open",
            `Next action ${action.id} is ${before.status}`,
          );
        }
        replace("nextActions", action);
        const undo = remember({
          updated: [{ kind: "nextActions", before, after: action.updatedAt }],
          created: [],
        });
        return { ...(await result({ nextAction: action as NextAction })), undo };
      },
    },
    research: {
      facts: (subject) =>
        result(
          own(store.sourceFacts)
            .filter((f) => subject === undefined || sameSubject(f.subject, subject))
            .toSorted(byCreated),
        ),
      interpretations: (subject) =>
        result(
          own(store.interpretations)
            .filter((i) => subject === undefined || sameSubject(i.subject, subject))
            .toSorted((a, b) => compareInstants(a.generatedAt, b.generatedAt)),
        ),
    },
    async undo(id) {
      const step = steps.get(id);
      if (!step) throw new RepositoryError("undo_unavailable");
      // Check everything first, so an undo applies completely or not at all.
      for (const entry of step.updated) {
        const now = (store[entry.kind] as Owned[]).find((r) => r.id === entry.before.id);
        if (!now || compareInstants(now.updatedAt, entry.after) !== 0) {
          throw new RepositoryError("conflict");
        }
      }
      for (const entry of step.created) {
        const now = (store[entry.kind] as Owned[]).find((r) => r.id === entry.id);
        if (!now || compareInstants(now.updatedAt, entry.after) !== 0) {
          throw new RepositoryError("conflict");
        }
      }
      const reverted: Reverted = {
        people: [],
        drafts: [],
        nextActions: [],
        removed: { drafts: [], interactions: [] },
      };
      for (const entry of step.updated) {
        switch (entry.kind) {
          case "people":
            replace("people", entry.before);
            reverted.people.push(entry.before);
            break;
          case "drafts":
            replace("drafts", entry.before);
            reverted.drafts.push(entry.before);
            break;
          case "nextActions":
            replace("nextActions", entry.before);
            reverted.nextActions.push(entry.before);
            break;
        }
      }
      for (const entry of step.created) {
        if (entry.kind === "drafts") {
          store.drafts = store.drafts.filter((d) => d.id !== entry.id);
          reverted.removed.drafts.push(entry.id as Draft["id"]);
        } else {
          store.interactions = store.interactions.filter((i) => i.id !== entry.id);
          reverted.removed.interactions.push(entry.id as Interaction["id"]);
        }
      }
      steps.delete(id);
      return result(reverted);
    },
  };
}

type Owned = { id: string; updatedAt: Instant };

/** What one write changed: records it updated (as they were), and records it created. */
type Step = {
  updated: (
    | { kind: "people"; before: Person; after: Instant }
    | { kind: "drafts"; before: Draft; after: Instant }
    | { kind: "nextActions"; before: NextAction; after: Instant }
  )[];
  created: { kind: "drafts" | "interactions"; id: string; after: Instant }[];
};
