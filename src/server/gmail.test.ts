// @vitest-environment node
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRepository } from "@/data/memory/memory-repository";
import type { Repository } from "@/data/repository";
import { GMAIL_SCOPE } from "@/integrations/gmail/oauth";
import { buildUser, TEST_USER_ID } from "@/test/builders";

/**
 * Connecting and disconnecting Gmail on the server, with Google, cookies and
 * the session replaced at their edges. The handshake must come back to the
 * same browser and user, in time, with the Gmail scope granted; tokens are
 * sealed before they're stored and never leave in the clear.
 */

const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
const session = { userId: TEST_USER_ID as string, method: "supabase" as const };
let repository: Repository;
let rateAllowed = true;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      if (options?.maxAge === 0) jar.delete(name);
      else jar.set(name, { value, options });
    },
  }),
}));
vi.mock("./auth", () => ({ requireSession: async () => session }));
vi.mock("./repository", () => ({ getRepository: async () => repository }));
vi.mock("./rate-limit", () => ({ allowed: async () => rateAllowed }));

const { disconnectGmail, finishGmailConnection, startGmailConnection, syncGmailForUser } =
  await import("./gmail");

const REFRESH_TOKEN = "1//refresh-token-that-must-never-leak";
const calls: { url: string; body?: string }[] = [];
let grantedScope = GMAIL_SCOPE;
let revokeWorks = true;

function google(url: string, init?: RequestInit): Response {
  const body = init?.body ? String(init.body) : undefined;
  calls.push({ url, body });
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return json({ access_token: "access", refresh_token: REFRESH_TOKEN, scope: grantedScope });
  }
  if (url.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/profile")) {
    return json({ emailAddress: "kofi@gmail.example", historyId: "4242" });
  }
  if (url.startsWith("https://oauth2.googleapis.com/revoke")) {
    return json({}, revokeWorks ? 200 : 400);
  }
  return json({}, 404);
}

beforeEach(() => {
  jar.clear();
  calls.length = 0;
  grantedScope = GMAIL_SCOPE;
  revokeWorks = true;
  rateAllowed = true;
  session.userId = TEST_USER_ID;
  repository = createMemoryRepository(
    {
      users: [buildUser()],
      companies: [],
      people: [],
      opportunities: [],
      interactions: [],
      drafts: [],
      nextActions: [],
      sourceFacts: [],
      interpretations: [],
    },
    TEST_USER_ID,
  );
  vi.stubEnv("REACHOUT_GMAIL_ENABLED", "true");
  vi.stubEnv("GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("GOOGLE_GMAIL_REDIRECT_URI", "https://reachout.example/settings/gmail/callback");
  vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => google(url, init)),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Starts connecting; returns the state Google would send back. */
async function start() {
  const started = await startGmailConnection();
  if (!("url" in started)) throw new Error(`Couldn't start: ${started.problem}`);
  return new URL(started.url).searchParams.get("state")!;
}

describe("connecting Gmail", () => {
  it("sends the browser to Google with a sealed, httpOnly handshake on the callback path", async () => {
    const started = await startGmailConnection();
    expect("url" in started && new URL(started.url).hostname).toBe("accounts.google.com");
    const cookie = jar.get("reachout-gmail-oauth")!;
    expect(cookie.options).toMatchObject({
      httpOnly: true,
      path: "/settings/gmail/callback",
      sameSite: "lax",
    });
    const state = "url" in started ? new URL(started.url).searchParams.get("state")! : "";
    expect(cookie.value).not.toContain(state);
  });

  it("the right state, from the same user, in time: connected, with the token sealed", async () => {
    const state = await start();
    expect(await finishGmailConnection(new URLSearchParams({ state, code: "auth-code" }))).toBe(
      "connected",
    );
    const token = calls.find((c) => c.url.includes("/token"))!;
    expect(token.body).toContain("code_verifier=");
    expect(await repository.gmail.connection()).toMatchObject({
      emailAddress: "kofi@gmail.example",
      status: "connected",
    });
    const lease = await repository.gmail.beginSync(0);
    expect(lease?.historyCursor).toBe("4242");
    expect(lease?.credential.sealed).toMatch(/^v1\./);
    expect(JSON.stringify(lease)).not.toContain(REFRESH_TOKEN);
    expect(JSON.stringify(await repository.gmail.connection())).not.toContain("v1.");
    // The handshake is spent.
    expect(jar.has("reachout-gmail-oauth")).toBe(false);
  });

  it("a mismatched or missing state is refused before Google is asked for tokens", async () => {
    await start();
    expect(
      await finishGmailConnection(new URLSearchParams({ state: "forged", code: "auth-code" })),
    ).toBe("invalid");
    expect(await finishGmailConnection(new URLSearchParams({ code: "auth-code" }))).toBe("invalid");
    expect(calls.some((c) => c.url.includes("/token"))).toBe(false);
    expect(await repository.gmail.connection()).toBeNull();
  });

  it("a handshake started by someone else doesn't work for this user", async () => {
    const state = await start();
    session.userId = "another-user";
    expect(await finishGmailConnection(new URLSearchParams({ state, code: "c" }))).toBe("invalid");
  });

  it("a handshake older than ten minutes is refused", async () => {
    const state = await start();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);
    expect(await finishGmailConnection(new URLSearchParams({ state, code: "c" }))).toBe("invalid");
  });

  it("saying no at Google, or not granting Gmail, stores nothing", async () => {
    const state = await start();
    expect(
      await finishGmailConnection(new URLSearchParams({ state, error: "access_denied" })),
    ).toBe("denied");
    const again = await start();
    grantedScope = "openid";
    expect(await finishGmailConnection(new URLSearchParams({ state: again, code: "c" }))).toBe(
      "permission",
    );
    expect(await repository.gmail.connection()).toBeNull();
  });

  it("starting again and again is limited", async () => {
    rateAllowed = false;
    expect(await startGmailConnection()).toEqual({ problem: "rate_limited" });
  });

  it("switched off for public launch (D-034): no flow, nothing stored, nothing reaches Google", async () => {
    vi.stubEnv("REACHOUT_GMAIL_ENABLED", "");
    expect(await startGmailConnection()).toEqual({ problem: "unavailable" });
    expect(jar.has("reachout-gmail-oauth")).toBe(false);
    expect(
      await finishGmailConnection(new URLSearchParams({ state: "anything", code: "anything" })),
    ).toBe("disabled");
    expect(await syncGmailForUser({ now: true })).toEqual({ status: "disabled" });
    expect(await repository.gmail.connection()).toBeNull();
    expect(calls).toEqual([]);
  });

  it("without Gmail configured, nothing reaches Google", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_GMAIL_REDIRECT_URI", "");
    vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", "");
    expect(await startGmailConnection()).toEqual({ problem: "unavailable" });
    expect(calls).toEqual([]);
  });
});

describe("disconnecting Gmail", () => {
  it("removes the credentials and asks Google to revoke the grant", async () => {
    const state = await start();
    await finishGmailConnection(new URLSearchParams({ state, code: "c" }));
    expect(await disconnectGmail()).toEqual({ revoked: true });
    const revoke = calls.find((c) => c.url.includes("/revoke"))!;
    expect(revoke.body).toContain(encodeURIComponent(REFRESH_TOKEN));
    expect(await repository.gmail.connection()).toBeNull();
    expect(await repository.gmail.beginSync(0)).toBeNull();
  });

  it("if Google can't be told, the local credentials are gone anyway, and it says so", async () => {
    const state = await start();
    await finishGmailConnection(new URLSearchParams({ state, code: "c" }));
    revokeWorks = false;
    expect(await disconnectGmail()).toEqual({ revoked: false });
    expect(await repository.gmail.connection()).toBeNull();
  });
});
