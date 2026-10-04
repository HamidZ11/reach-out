import type { z } from "zod";
import { CompanySchema } from "@/domain/company";
import type { Company } from "@/domain/company";
import { DraftSchema } from "@/domain/draft";
import type { Draft } from "@/domain/draft";
import { UserIdSchema } from "@/domain/ids";
import { InteractionSchema } from "@/domain/interaction";
import type { Interaction } from "@/domain/interaction";
import { NextActionSchema } from "@/domain/next-action";
import type { NextAction } from "@/domain/next-action";
import { OpportunitySchema } from "@/domain/opportunity";
import type { Opportunity } from "@/domain/opportunity";
import { PersonSchema } from "@/domain/person";
import type { Person } from "@/domain/person";
import { UserSchema } from "@/domain/user";
import type { User } from "@/domain/user";

/**
 * Minimal valid records for focused tests. Every builder validates through the
 * real schema, so a fixture can never be shaped differently from production data.
 */

export const TEST_USER_ID = UserIdSchema.parse("usr_test");

const T0 = "2026-01-01T09:00:00Z";
const owned = { userId: TEST_USER_ID, createdAt: T0, updatedAt: T0 };

type Overrides<S extends z.ZodType> = Partial<z.input<S>>;

export function buildUser(overrides: Overrides<typeof UserSchema> = {}): User {
  return UserSchema.parse({
    id: TEST_USER_ID,
    name: "Test User",
    email: "test.user@example.com",
    timeZone: "Europe/London",
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  });
}

export function buildCompany(overrides: Overrides<typeof CompanySchema> = {}): Company {
  return CompanySchema.parse({ id: "cmp_test", name: "Test Company", ...owned, ...overrides });
}

export function buildPerson(overrides: Overrides<typeof PersonSchema> = {}): Person {
  return PersonSchema.parse({
    id: "prs_test",
    name: "Test Person",
    role: "Engineer",
    source: { kind: "other" },
    relationshipStatus: "new",
    ...owned,
    ...overrides,
  });
}

export function buildOpportunity(overrides: Overrides<typeof OpportunitySchema> = {}): Opportunity {
  return OpportunitySchema.parse({
    id: "opp_test",
    title: "Test Opportunity",
    companyId: "cmp_test",
    status: "identified",
    personIds: [],
    ...owned,
    ...overrides,
  });
}

export function buildInteraction(overrides: Overrides<typeof InteractionSchema> = {}): Interaction {
  return InteractionSchema.parse({
    id: "int_test",
    personId: "prs_test",
    kind: "message_sent",
    channel: "email",
    occurredAt: T0,
    summary: "Test message",
    ...owned,
    ...overrides,
  });
}

export function buildDraft(overrides: Overrides<typeof DraftSchema> = {}): Draft {
  return DraftSchema.parse({
    id: "drf_test",
    personId: "prs_test",
    channel: "email",
    subject: "Test subject",
    body: "Test body",
    origin: "user",
    status: "awaiting_approval",
    ...owned,
    ...overrides,
  });
}

export function buildNextAction(overrides: Overrides<typeof NextActionSchema> = {}): NextAction {
  return NextActionSchema.parse({
    id: "act_test",
    kind: "follow_up",
    title: "Test action",
    personId: "prs_test",
    dueOn: "2026-01-02",
    status: "open",
    ...owned,
    ...overrides,
  });
}
