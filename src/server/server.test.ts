// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEED_USER_ID } from "@/data/seed/dataset";
import { AuthNotConfiguredError, getSession, requireSession } from "./auth";
import { authMode } from "./config";
import { DEFAULT_NEXT, safeNextPath } from "./next-path";
import { getRepository, provisionalName } from "./repository";

// No request in a unit test: an empty cookie jar stands in for a signed-out browser.
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
  headers: async () => new Headers(),
}));

const SUPABASE = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("how the server knows who you are", () => {
  it("fails closed when nothing is configured, in development and in production", () => {
    expect(() => authMode({ NODE_ENV: "development" })).toThrow(AuthNotConfiguredError);
    expect(() => authMode({ NODE_ENV: "production" })).toThrow(AuthNotConfiguredError);
  });

  it("uses Supabase when it is configured", () => {
    expect(authMode({ NODE_ENV: "production", ...SUPABASE })).toEqual({
      kind: "supabase",
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("allows plain http only to a Supabase on this machine", () => {
    const local = { SUPABASE_URL: "http://127.0.0.1:55321", SUPABASE_PUBLISHABLE_KEY: "k" };
    expect(authMode({ NODE_ENV: "development", ...local }).kind).toBe("supabase");
    expect(authMode({ NODE_ENV: "production", ...local }).kind).toBe("supabase");
    for (const SUPABASE_URL of ["http://project.supabase.co", "not a url", "ftp://127.0.0.1"]) {
      expect(() =>
        authMode({ NODE_ENV: "production", SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: "k" }),
      ).toThrow(AuthNotConfiguredError);
    }
  });

  it("runs the seed session only when asked for explicitly, outside production", () => {
    expect(authMode({ NODE_ENV: "development", REACHOUT_DEV_SEED: "true" })).toEqual({
      kind: "seed",
    });
    expect(() => authMode({ NODE_ENV: "development", REACHOUT_DEV_SEED: "1" })).toThrow(
      AuthNotConfiguredError,
    );
  });

  it("never runs the seed session in production, even if asked, even with Supabase configured", () => {
    expect(() => authMode({ NODE_ENV: "production", REACHOUT_DEV_SEED: "true" })).toThrow(
      /refused in production/,
    );
    expect(() =>
      authMode({ NODE_ENV: "production", REACHOUT_DEV_SEED: "true", ...SUPABASE }),
    ).toThrow(/refused in production/);
  });
});

describe("the server boundary", () => {
  it("in production without configuration, sessions and data fail closed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("REACHOUT_DEV_SEED", "");
    await expect(getSession()).rejects.toBeInstanceOf(AuthNotConfiguredError);
    await expect(getRepository()).rejects.toBeInstanceOf(AuthNotConfiguredError);
  });

  it("in production with the seed session switched on, it refuses rather than serve seed data", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REACHOUT_DEV_SEED", "true");
    await expect(getRepository()).rejects.toThrow(/refused in production/);
  });

  it("the explicit development seed session is the seed user, and says so", async () => {
    vi.stubEnv("REACHOUT_DEV_SEED", "true");
    await expect(getSession()).resolves.toEqual({ userId: SEED_USER_ID, method: "development" });
    const repository = await getRepository();
    expect(repository.userId).toBe(SEED_USER_ID);
    expect((await repository.user.get()).id).toBe(SEED_USER_ID);
  });

  it("with Supabase and no session cookie, there is no session, and reads go to sign in", async () => {
    vi.stubEnv("REACHOUT_DEV_SEED", "");
    vi.stubEnv("SUPABASE_URL", SUPABASE.SUPABASE_URL);
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", SUPABASE.SUPABASE_PUBLISHABLE_KEY);
    await expect(getSession()).resolves.toBeNull();
    await expect(requireSession()).rejects.toMatchObject({
      digest: expect.stringContaining("/sign-in"),
    });
    await expect(getRepository()).rejects.toMatchObject({
      digest: expect.stringContaining("/sign-in"),
    });
  });
});

describe("where sign-in returns you", () => {
  it("keeps paths inside Reachout, with their query", () => {
    expect(safeNextPath("/people?person=3f0c2a5e-0000-4000-8000-000000000000")).toBe(
      "/people?person=3f0c2a5e-0000-4000-8000-000000000000",
    );
    expect(safeNextPath("/companies?company=x&from=y")).toBe("/companies?company=x&from=y");
  });

  it("never leaves the site or loops back into sign-in", () => {
    for (const value of [
      "https://evil.example/",
      "//evil.example",
      "/\\evil.example",
      "http:evil.example",
      "javascript:alert(1)",
      "/sign-in",
      "/auth/confirm?token_hash=x",
      "/\tevil",
      "",
      undefined,
      ["/today"],
      `/${"a".repeat(600)}`,
    ]) {
      expect(safeNextPath(value)).toBe(DEFAULT_NEXT);
    }
  });
});

describe("a new account's first name", () => {
  it("is the user's own address before the @, until they change it", () => {
    expect(provisionalName("aisha.rahman@student.example")).toBe("aisha.rahman");
    expect(provisionalName(undefined)).toBe("You");
    expect(provisionalName("@example.com")).toBe("You");
  });
});
