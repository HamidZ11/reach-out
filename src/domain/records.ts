import { z } from "zod";
import { CompanySchema, companyNameKey } from "./company";
import { DraftSchema } from "./draft";
import type { UserId } from "./ids";
import { InteractionSchema } from "./interaction";
import { NextActionSchema } from "./next-action";
import { OpportunitySchema } from "./opportunity";
import { PersonSchema } from "./person";
import type { Subject } from "./research";
import { InterpretationSchema, SourceFactSchema } from "./research";
import { UserSchema } from "./user";

/** Every record kind, as one validated set. Used for seed data and integrity checks. */
export const RecordSetSchema = z.object({
  users: z.array(UserSchema),
  companies: z.array(CompanySchema),
  people: z.array(PersonSchema),
  opportunities: z.array(OpportunitySchema),
  interactions: z.array(InteractionSchema),
  drafts: z.array(DraftSchema),
  nextActions: z.array(NextActionSchema),
  sourceFacts: z.array(SourceFactSchema),
  interpretations: z.array(InterpretationSchema),
});
export type RecordSet = z.infer<typeof RecordSetSchema>;

type Owned = { id: string; userId: UserId };

/**
 * Cross-record invariants that a single schema cannot express. Returns
 * human-readable violations; an empty array means the set is consistent.
 *
 * - ids are unique within each collection
 * - every record belongs to an existing user
 * - every reference resolves to a record owned by the same user
 * - a sent draft points at a message_sent to the same person
 * - company names are unique per user
 * - a person has at most one open follow-up
 */
export function findIntegrityViolations(records: RecordSet): string[] {
  const problems: string[] = [];
  const userIds = new Set<string>(records.users.map((u) => u.id));

  const index = <T extends Owned>(label: string, items: readonly T[]) => {
    const byId = new Map<string, T>();
    for (const item of items) {
      if (byId.has(item.id)) problems.push(`${label} ${item.id}: duplicate id`);
      if (!userIds.has(item.userId))
        problems.push(`${label} ${item.id}: unknown owner ${item.userId}`);
      byId.set(item.id, item);
    }
    return byId;
  };

  const companies = index("company", records.companies);
  const people = index("person", records.people);
  const opportunities = index("opportunity", records.opportunities);
  const interactions = index("interaction", records.interactions);
  index("draft", records.drafts);
  index("next action", records.nextActions);
  const facts = index("source fact", records.sourceFacts);
  index("interpretation", records.interpretations);

  const ref = (
    from: Owned & { label: string },
    field: string,
    target: Map<string, Owned>,
    id?: string,
  ) => {
    if (id === undefined) return;
    const found = target.get(id);
    if (!found) problems.push(`${from.label} ${from.id}: ${field} ${id} does not exist`);
    else if (found.userId !== from.userId) {
      problems.push(`${from.label} ${from.id}: ${field} ${id} belongs to another user`);
    }
  };
  const subjectRef = (from: Owned & { label: string }, subject: Subject) => {
    const target = { person: people, company: companies, opportunity: opportunities }[subject.type];
    ref(from, `subject ${subject.type}`, target, subject.id);
  };

  for (const p of records.people) {
    ref({ ...p, label: "person" }, "companyId", companies, p.companyId);
  }
  for (const o of records.opportunities) {
    const from = { ...o, label: "opportunity" };
    ref(from, "companyId", companies, o.companyId);
    for (const personId of o.personIds) ref(from, "personId", people, personId);
  }
  for (const i of records.interactions) {
    const from = { ...i, label: "interaction" };
    ref(from, "personId", people, i.personId);
    ref(from, "opportunityId", opportunities, i.opportunityId);
  }
  for (const d of records.drafts) {
    const from = { ...d, label: "draft" };
    ref(from, "personId", people, d.personId);
    ref(from, "opportunityId", opportunities, d.opportunityId);
    if (d.status === "sent") {
      ref(from, "sentInteractionId", interactions, d.sentInteractionId);
      const sent = interactions.get(d.sentInteractionId);
      if (sent && (sent.kind !== "message_sent" || sent.personId !== d.personId)) {
        problems.push(`draft ${d.id}: sentInteractionId must be a message_sent to the same person`);
      }
    }
  }
  for (const a of records.nextActions) {
    const from = { ...a, label: "next action" };
    ref(from, "personId", people, a.personId);
    ref(from, "opportunityId", opportunities, a.opportunityId);
    ref(from, "interactionId", interactions, a.interactionId);
  }
  for (const f of records.sourceFacts) {
    subjectRef({ ...f, label: "source fact" }, f.subject);
  }
  for (const i of records.interpretations) {
    const from = { ...i, label: "interpretation" };
    subjectRef(from, i.subject);
    for (const factId of i.basedOnFactIds) ref(from, "basedOnFactId", facts, factId);
  }

  const companyNames = new Set<string>();
  for (const c of records.companies) {
    const key = `${c.userId}:${companyNameKey(c.name)}`;
    if (companyNames.has(key)) problems.push(`company ${c.id}: duplicate name "${c.name}"`);
    companyNames.add(key);
  }

  const openFollowUps = new Set<string>();
  for (const a of records.nextActions) {
    if (a.status !== "open" || a.kind !== "follow_up" || a.personId === undefined) continue;
    if (openFollowUps.has(a.personId)) {
      problems.push(`next action ${a.id}: person ${a.personId} already has an open follow-up`);
    }
    openFollowUps.add(a.personId);
  }

  return problems;
}
