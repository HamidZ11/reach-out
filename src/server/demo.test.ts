// @vitest-environment node
import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_USER_ID } from "@/data/seed/dataset";
import type { DraftId, NextActionId } from "@/domain/ids";
import {
  approveDraftStep,
  completeNextActionStep,
  markDraftSentStep,
  reviseDraftStep,
  snoozeNextActionStep,
} from "@/features/workspace/operations";
import { DEMO_COOKIE } from "./demo-cookie";

/**
 * The demo workspace (D-035): entered on purpose, recognised only by a cookie
 * this server signed, and never a way into Supabase or anyone's real records.
 * Cookies, Supabase and Google are replaced at their edges.
 */

type Cookie = { value: string; options?: Record<string, unknown> };
const jar = new Map<string, Cookie>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    getAll: () => [...jar].map(([name, c]) => ({ name, value: c.value })),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      if (options?.maxAge === 0) jar.delete(name);
      else jar.set(name, { value, options });
    },
  }),
  headers: async () => new Headers(),
}));

/** What Supabase says about this browser: a real sign-in, or none. */
const real = vi.hoisted(() => ({ userId: null as string | null }));
const REAL_USER = "6c1f6a0e-3b7a-4c55-9a43-2f0b8f0d1e11";
const REAL_WORKSPACE = "0d7c4c0a-8a3e-4f63-8f43-5b8d2a6e9c21";
const getSupabase = vi.hoisted(() => vi.fn());
vi.mock("./supabase", () => ({ getSupabase }));

const { getSession, requireSession } = await import("./auth");
const { getRepository } = await import("./repository");
const { demoRepository, demoToken, verifyDemoToken } = await import("./demo");
const { enterDemo, exitDemo, resetDemo } = await import("@/app/demo/actions");
const gmail = await import("./gmail");

const SUPABASE = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

beforeEach(() => {
  jar.clear();
  real.userId = null;
  getSupabase.mockImplementation(async () => ({
    auth: {
      getClaims: async () => ({
        data: real.userId ? { claims: { sub: real.userId, email: "kofi@student.example" } } : null,
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: { workspace_id: REAL_WORKSPACE }, error: null }),
          }),
        }),
      }),
    }),
  }));
  for (const [name, value] of Object.entries(SUPABASE)) vi.stubEnv(name, value);
  vi.stubEnv("REACHOUT_DEV_SEED", "");
  // Nothing in the demo reaches the network.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("The demo must not reach the network");
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Runs a Server Action that ends in a redirect; answers where it went. */
async function redirectOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2] ?? "";
    throw error;
  }
  throw new Error("Expected a redirect");
}

const demoCookie = () => jar.get(DEMO_COOKIE);
const demoIdOf = () => verifyDemoToken(demoCookie()?.value) ?? "";
const NOW = new Date("2026-10-07T08:00:00Z");

describe("entering the demo", () => {
  it("Try the demo signs a demo id into an httpOnly cookie and lands on Today", async () => {
    expect(await redirectOf(enterDemo)).toBe("/today");
    const cookie = demoCookie();
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie?.value).toMatch(/^[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$/);
  });

  it("is the demo's fictional student, without asking Supabase", async () => {
    await redirectOf(enterDemo);
    await expect(getSession()).resolves.toEqual({
      method: "demo",
      userId: SEED_USER_ID,
      demoId: demoIdOf(),
    });
    const repository = await getRepository();
    expect(repository.userId).toBe(SEED_USER_ID);
    expect((await repository.user.get()).onboardingCompletedAt).toBeDefined();
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it("needs no configuration at all: not Supabase, and not the development seed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    await redirectOf(enterDemo);
    expect((await getRepository()).userId).toBe(SEED_USER_ID);
    // Without the demo, the same deployment still fails closed.
    jar.clear();
    await expect(getSession()).rejects.toThrow(/not configured/);
  });

  it("entering again carries on in the same demo", async () => {
    await redirectOf(enterDemo);
    const first = demoCookie()?.value;
    await redirectOf(enterDemo);
    expect(demoCookie()?.value).toBe(first);
  });
});

describe("the demo's boundary", () => {
  it("without the demo, a visitor has no session: it never silently becomes the demo", async () => {
    await expect(getSession()).resolves.toBeNull();
    await expect(requireSession()).rejects.toMatchObject({
      digest: expect.stringContaining("/sign-in"),
    });
  });

  it("a real sign-in still uses Supabase and the account's own workspace", async () => {
    real.userId = REAL_USER;
    await expect(getSession()).resolves.toMatchObject({ method: "supabase", userId: REAL_USER });
    const repository = await getRepository();
    expect(repository.userId).toBe(REAL_USER);
    expect(getSupabase).toHaveBeenCalled();
  });

  it("in the demo, even a browser also signed in for real sees only the demo, never Supabase", async () => {
    real.userId = REAL_USER;
    await redirectOf(enterDemo);
    expect((await getRepository()).userId).toBe(SEED_USER_ID);
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it("a forged, altered or foreign cookie is no demo", async () => {
    const id = randomBytes(16).toString("hex");
    const valid = demoToken(id);
    const [, mac = ""] = valid.split(".");
    const foreign = createHmac("sha256", randomBytes(32))
      .update(`reachout:demo:v1:${id}`)
      .digest("base64url");
    const flip = (s: string) => (s.startsWith("a") ? `b${s.slice(1)}` : `a${s.slice(1)}`);
    for (const value of [
      `${flip(id)}.${mac}`, // someone else's id under this signature
      `${id}.${flip(mac)}`,
      `${id}.${foreign}`, // signed by another server's key
      `${SEED_USER_ID}.${mac}`,
      `${REAL_USER}.${mac}`,
      `${valid}.extra`,
      id,
      "",
      "x".repeat(4096),
    ]) {
      jar.set(DEMO_COOKIE, { value });
      expect(verifyDemoToken(value), value.slice(0, 40)).toBeNull();
      await expect(getSession()).resolves.toBeNull();
    }
  });

  it("the demo id only chooses a copy of the fictional records: never a user or workspace", async () => {
    await redirectOf(enterDemo);
    const session = await getSession();
    expect(session?.userId).toBe(SEED_USER_ID);
    // A real account's id can't be signed in as a demo id: it isn't one.
    expect(verifyDemoToken(`${REAL_USER.replaceAll("-", "")}.${"A".repeat(43)}`)).toBeNull();
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it("can't start Gmail, even where Gmail is switched on", async () => {
    vi.stubEnv("REACHOUT_GMAIL_ENABLED", "true");
    vi.stubEnv("GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("GOOGLE_GMAIL_REDIRECT_URI", "https://reachout.example/settings/gmail/callback");
    vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    await redirectOf(enterDemo);
    await expect(gmail.gmailStatus()).resolves.toEqual({ available: false, connection: null });
    await expect(gmail.startGmailConnection()).resolves.toEqual({ problem: "unavailable" });
    await expect(
      gmail.finishGmailConnection(new URLSearchParams({ state: "s", code: "c" })),
    ).resolves.toBe("disabled");
    await expect(gmail.syncGmailForUser({ now: true })).resolves.toEqual({ status: "disabled" });
    expect(jar.has("reachout-gmail-oauth")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(getSupabase).not.toHaveBeenCalled();
  });
});

describe("changes in the demo", () => {
  const ids = () => [randomBytes(16).toString("hex"), randomBytes(16).toString("hex")] as const;

  it("work for the visit: done, snoozed, edited, approved and sent", async () => {
    const [id] = ids();
    const repository = demoRepository(id, NOW);
    const actions = await repository.nextActions.list();
    const [first, second] = actions.filter((a) => a.status === "open");
    expect(
      await completeNextActionStep(
        repository,
        { id: first!.id as NextActionId, expected: first!.updatedAt },
        NOW,
      ),
    ).toMatchObject({ ok: true });
    expect(
      await snoozeNextActionStep(
        repository,
        { id: second!.id as NextActionId, days: 2, expected: second!.updatedAt },
        NOW,
      ),
    ).toMatchObject({ ok: true });

    const awaiting = (await repository.drafts.list()).find(
      (d) => d.status === "awaiting_approval",
    )!;
    const draftId = awaiting.id as DraftId;
    const revised = await reviseDraftStep(
      repository,
      { id: draftId, expected: awaiting.updatedAt, body: "Hello again, with a shorter note." },
      NOW,
    );
    expect(revised).toMatchObject({ ok: true });
    let draft = (await repository.drafts.get(draftId))!;
    expect(
      await approveDraftStep(repository, { id: draftId, expected: draft.updatedAt }, NOW),
    ).toMatchObject({ ok: true });
    draft = (await repository.drafts.get(draftId))!;
    expect(
      await markDraftSentStep(repository, { id: draftId, expected: draft.updatedAt }, NOW),
    ).toMatchObject({ ok: true });

    // The same demo, asked for again, has all of it.
    const again = demoRepository(id, NOW);
    expect((await again.nextActions.get(first!.id))?.status).toBe("done");
    expect((await again.drafts.get(draftId))?.status).toBe("sent");
    expect(
      (await again.interactions.list()).some(
        (i) => i.kind === "message_sent" && i.body === "Hello again, with a shorter note.",
      ),
    ).toBe(true);
  });

  it("one visitor's changes never reach another's demo", async () => {
    const [mine, theirs] = ids();
    const repository = demoRepository(mine, NOW);
    const [open] = (await repository.nextActions.list()).filter((a) => a.status === "open");
    await completeNextActionStep(
      repository,
      { id: open!.id as NextActionId, expected: open!.updatedAt },
      NOW,
    );
    expect((await demoRepository(theirs, NOW).nextActions.get(open!.id))?.status).toBe("open");
  });

  it("Reset demo starts again from the beginning, and lands on Today", async () => {
    await redirectOf(enterDemo);
    const id = demoIdOf();
    const repository = demoRepository(id);
    const [open] = (await repository.nextActions.list()).filter((a) => a.status === "open");
    await completeNextActionStep(
      repository,
      { id: open!.id as NextActionId, expected: open!.updatedAt },
      new Date(),
    );
    expect(await redirectOf(resetDemo)).toBe("/today");
    expect((await (await getRepository()).nextActions.get(open!.id))?.status).toBe("open");
  });

  it("Reset demo outside the demo changes nothing and goes to the landing page", async () => {
    real.userId = REAL_USER;
    expect(await redirectOf(resetDemo)).toBe("/");
    expect((await getRepository()).userId).toBe(REAL_USER);
  });

  it("a demo left idle for hours starts afresh", async () => {
    const [id] = ids();
    const repository = demoRepository(id, NOW);
    const [open] = (await repository.nextActions.list()).filter((a) => a.status === "open");
    await completeNextActionStep(
      repository,
      { id: open!.id as NextActionId, expected: open!.updatedAt },
      NOW,
    );
    const later = new Date(NOW.getTime() + 3 * 60 * 60 * 1000);
    expect((await demoRepository(id, later).nextActions.get(open!.id))?.status).toBe("open");
  });
});

describe("leaving the demo", () => {
  it("Exit demo clears the cookie, forgets the changes, and returns to the landing page", async () => {
    await redirectOf(enterDemo);
    const id = demoIdOf();
    const repository = demoRepository(id);
    const [open] = (await repository.nextActions.list()).filter((a) => a.status === "open");
    await completeNextActionStep(
      repository,
      { id: open!.id as NextActionId, expected: open!.updatedAt },
      new Date(),
    );

    expect(await redirectOf(exitDemo)).toBe("/");
    expect(demoCookie()).toBeUndefined();
    // No longer the demo: the app asks for sign-in again.
    await expect(getSession()).resolves.toBeNull();
    await expect(getRepository()).rejects.toMatchObject({
      digest: expect.stringContaining("/sign-in"),
    });
    // Coming back with the old id would start afresh.
    expect((await demoRepository(id).nextActions.get(open!.id))?.status).toBe("open");
  });
});
