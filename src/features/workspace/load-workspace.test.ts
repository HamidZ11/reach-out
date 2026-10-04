import { describe, expect, it } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import { loadWorkspace } from "./load-workspace";

const anchor = calendarDate("2026-10-05");
const repository = () => createSeedRepository(createSeedDataset(anchor), SEED_USER_ID);

describe("loadWorkspace", () => {
  it("reads the user's records through the Repository, on the user's calendar day", async () => {
    // 23:30 in UTC is already the next day in London (BST).
    const workspace = await loadWorkspace(repository(), new Date("2026-10-04T23:30:00Z"));

    expect(workspace.user.id).toBe(SEED_USER_ID);
    expect(workspace.today).toBe("2026-10-05");
    expect(workspace.now).toBe("2026-10-04T23:30:00.000Z");
    expect(workspace.people.length).toBeGreaterThan(0);
    expect(workspace.nextActions.length).toBeGreaterThan(0);
  });

  it("reads research context only when a screen asks for it", async () => {
    const now = new Date("2026-10-05T09:00:00Z");
    const plain = await loadWorkspace(repository(), now);
    const withResearch = await loadWorkspace(repository(), now, { research: true });

    expect(plain.facts).toEqual([]);
    expect(withResearch.facts.length).toBeGreaterThan(0);
    expect(withResearch.interpretations.length).toBeGreaterThan(0);
  });
});
