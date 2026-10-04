import { describe, expect, it } from "vitest";
import { CompanyIdSchema, PersonIdSchema, UserIdSchema } from "@/domain/ids";
import { findIntegrityViolations } from "@/domain/records";
import { calendarDate } from "@/domain/time";
import { buildCompany, buildPerson, buildUser } from "@/test/builders";
import { createSeedDataset, SEED_USER_ID } from "./dataset";
import { createSeedRepository } from "./seed-repository";

const records = createSeedDataset(calendarDate("2026-10-05"));
const repository = createSeedRepository(records, SEED_USER_ID);
const LEDGERLINE = CompanyIdSchema.parse("cmp_01");
const DANIEL = PersonIdSchema.parse("prs_01");

describe("seed dataset", () => {
  it("is internally consistent", () => {
    expect(findIntegrityViolations(records)).toEqual([]);
  });

  it("is a realistic, modest size", () => {
    expect(records.people.length).toBeGreaterThanOrEqual(8);
    expect(records.people.length).toBeLessThanOrEqual(12);
    expect(records.opportunities.length).toBeGreaterThanOrEqual(4);
    expect(records.opportunities.length).toBeLessThanOrEqual(6);
    expect(records.companies.length).toBeGreaterThanOrEqual(4);
    expect(records.companies.length).toBeLessThanOrEqual(5);
  });
});

describe("seed repository", () => {
  it("answers filtered queries in the documented order", async () => {
    const people = await repository.people.list({ companyId: LEDGERLINE });
    expect(people.map((p) => p.name)).toEqual([
      "Daniel Mensah",
      "Grace Whitfield",
      "James O'Connor",
    ]);

    const history = await repository.interactions.list({ personId: DANIEL });
    expect(history.map((i) => i.kind)).toEqual(["message_sent", "message_received"]);

    const facts = await repository.research.facts({ type: "person", id: DANIEL });
    const interpretations = await repository.research.interpretations({
      type: "person",
      id: DANIEL,
    });
    expect(facts).toHaveLength(2);
    expect(interpretations.map((i) => i.basedOnFactIds)).toEqual([facts.map((f) => f.id)]);

    const open = await repository.nextActions.list({ status: "open" });
    expect(open.map((a) => a.dueOn)).toEqual(open.map((a) => a.dueOn).toSorted());
  });

  it("returns null for ids it does not hold", async () => {
    expect(await repository.people.get(PersonIdSchema.parse("prs_missing"))).toBeNull();
  });

  it("only returns records owned by the user it was created for", async () => {
    const otherUserId = UserIdSchema.parse("usr_other");
    const withOtherUser = {
      ...records,
      users: [...records.users, buildUser({ id: otherUserId, email: "other@example.com" })],
      companies: [
        ...records.companies,
        buildCompany({ id: "cmp_other", userId: otherUserId, name: "Ledgerline" }),
      ],
      people: [
        ...records.people,
        buildPerson({ id: "prs_other", userId: otherUserId, companyId: "cmp_other" }),
      ],
    };

    const mine = createSeedRepository(withOtherUser, SEED_USER_ID);
    expect((await mine.people.list()).map((p) => p.id)).not.toContain("prs_other");
    expect(await mine.people.get(PersonIdSchema.parse("prs_other"))).toBeNull();

    const theirs = createSeedRepository(withOtherUser, otherUserId);
    expect((await theirs.people.list()).map((p) => p.id)).toEqual(["prs_other"]);
    expect((await theirs.companies.list()).map((c) => c.id)).toEqual(["cmp_other"]);
  });

  it("returns copies, so callers cannot change stored records", async () => {
    const daniel = await repository.people.get(DANIEL);
    if (!daniel) throw new Error("expected seed person");
    daniel.name = "Changed";
    expect((await repository.people.get(DANIEL))?.name).toBe("Daniel Mensah");
  });

  it("refuses records that reference another user's data", () => {
    const otherUserId = UserIdSchema.parse("usr_other");
    const broken = {
      ...records,
      users: [...records.users, buildUser({ id: otherUserId, email: "other@example.com" })],
      companies: [...records.companies, buildCompany({ id: "cmp_other", userId: otherUserId })],
      people: [
        ...records.people,
        buildPerson({ id: "prs_cross", userId: SEED_USER_ID, companyId: "cmp_other" }),
      ],
    };
    expect(() => createSeedRepository(broken, SEED_USER_ID)).toThrow(/belongs to another user/);
  });
});
