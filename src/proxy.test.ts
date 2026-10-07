// @vitest-environment node
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";
import { DEMO_COOKIE } from "./server/demo-cookie";

/**
 * The proxy's routing (the optimistic check; the server checks again): the
 * landing page is public, the app sends signed-out visitors to sign in, and a
 * browser in the demo (D-035) isn't sent there.
 */

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("REACHOUT_DEV_SEED", "");
  // Signed out: there is no session for Supabase to look up.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("No network in this test");
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function visit(path: string, cookie?: string) {
  const request = new NextRequest(new URL(path, "http://localhost:3001"));
  if (cookie !== undefined) request.cookies.set(DEMO_COOKIE, cookie);
  return proxy(request);
}

const DEMO_SHAPED = `${randomBytes(16).toString("hex")}.${"A".repeat(43)}`;

describe("routing before the page", () => {
  it("the landing page is public, with the CSP", async () => {
    const response = await visit("/");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain("'nonce-");
  });

  it("the app still sends a signed-out visitor to sign in, remembering where they were going", async () => {
    for (const path of ["/today", "/people", "/settings", "/onboarding"]) {
      const response = await visit(path);
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/sign-in");
      // Today is where signing in returns anyway, so it goes unsaid.
      expect(location.searchParams.get("next")).toBe(path === "/today" ? null : path);
    }
  });

  it("a browser in the demo goes on to the app; the server then checks the signature", async () => {
    const response = await visit("/today", DEMO_SHAPED);
    expect(response.headers.get("location")).toBeNull();
  });

  it("anything that isn't shaped like the demo's cookie is still sent to sign in", async () => {
    for (const value of ["usr_01", "true", "", `${DEMO_SHAPED}.x`]) {
      const response = await visit("/today", value);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/sign-in");
    }
  });

  it("sign-in stays reachable from the demo, to sign in for real", async () => {
    const response = await visit("/sign-in", DEMO_SHAPED);
    expect(response.headers.get("location")).toBeNull();
  });
});
