import { describe, expect, it, vi } from "vitest";
import { SEED_USER_ID } from "@/data/seed/dataset";
import { AuthNotConfiguredError, getSession } from "./auth";
import { getRepository } from "./repository";

describe("server boundary", () => {
  it("runs as the seed user outside production, and says so", async () => {
    await expect(getSession()).resolves.toEqual({ userId: SEED_USER_ID, method: "development" });
  });

  it("fails closed in production until an auth provider is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(getSession()).rejects.toBeInstanceOf(AuthNotConfiguredError);
    await expect(getRepository()).rejects.toBeInstanceOf(AuthNotConfiguredError);
  });

  it("hands out a repository scoped to the session user", async () => {
    const repository = await getRepository();
    expect(repository.userId).toBe(SEED_USER_ID);
    expect((await repository.user.get()).id).toBe(SEED_USER_ID);
  });
});
