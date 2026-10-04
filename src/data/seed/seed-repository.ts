import type { UserId } from "@/domain/ids";
import type { RecordSet } from "@/domain/records";
import { findIntegrityViolations } from "@/domain/records";
import { sameSubject } from "@/domain/research";
import { compareInstants } from "@/domain/time";
import type { Repository } from "../repository";

/**
 * In-memory, read-only Repository over a validated RecordSet. Used in
 * development (with the seed dataset) and in tests (with any fixture).
 * Returns copies, so callers cannot mutate the underlying records.
 */
export function createSeedRepository(records: RecordSet, userId: UserId): Repository {
  const violations = findIntegrityViolations(records);
  if (violations.length > 0) {
    throw new Error(`Seed records are inconsistent:\n- ${violations.join("\n- ")}`);
  }
  const user = records.users.find((u) => u.id === userId);
  if (!user) throw new Error(`No user ${userId} in seed records`);

  const own = <T extends { userId: UserId }>(items: readonly T[]) =>
    items.filter((item) => item.userId === userId);
  const result = <T>(value: T): Promise<T> => Promise.resolve(structuredClone(value));
  const findOwn = <T extends { id: string; userId: UserId }>(items: readonly T[], id: string) =>
    result(own(items).find((item) => item.id === id) ?? null);
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "en-GB");
  const byCreated = (a: { createdAt: string }, b: { createdAt: string }) =>
    Date.parse(a.createdAt) - Date.parse(b.createdAt);

  return {
    userId,
    user: {
      get: () => result(user),
    },
    companies: {
      list: () => result(own(records.companies).toSorted(byName)),
      get: (id) => findOwn(records.companies, id),
    },
    people: {
      list: (filter = {}) =>
        result(
          own(records.people)
            .filter((p) => filter.companyId === undefined || p.companyId === filter.companyId)
            .toSorted(byName),
        ),
      get: (id) => findOwn(records.people, id),
    },
    opportunities: {
      list: (filter = {}) =>
        result(
          own(records.opportunities)
            .filter((o) => filter.companyId === undefined || o.companyId === filter.companyId)
            .toSorted(byCreated),
        ),
      get: (id) => findOwn(records.opportunities, id),
    },
    interactions: {
      list: (filter = {}) =>
        result(
          own(records.interactions)
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
          own(records.drafts)
            .filter((d) => filter.status === undefined || d.status === filter.status)
            .filter((d) => filter.personId === undefined || d.personId === filter.personId)
            .toSorted(byCreated),
        ),
    },
    nextActions: {
      list: (filter = {}) =>
        result(
          own(records.nextActions)
            .filter((a) => filter.status === undefined || a.status === filter.status)
            .filter((a) => filter.personId === undefined || a.personId === filter.personId)
            .filter(
              (a) => filter.opportunityId === undefined || a.opportunityId === filter.opportunityId,
            )
            .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn)),
        ),
    },
    research: {
      facts: (subject) =>
        result(
          own(records.sourceFacts)
            .filter((f) => sameSubject(f.subject, subject))
            .toSorted(byCreated),
        ),
      interpretations: (subject) =>
        result(
          own(records.interpretations)
            .filter((i) => sameSubject(i.subject, subject))
            .toSorted((a, b) => compareInstants(a.generatedAt, b.generatedAt)),
        ),
    },
  };
}
