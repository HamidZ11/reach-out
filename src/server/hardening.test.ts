// @vitest-environment node
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { gmailConfig, rateLimitSecret } from "./config";
import { contentSecurityPolicy } from "./csp";
import { clientAddress } from "./rate-limit";

const KEY = randomBytes(32).toString("base64");
const GMAIL = {
  REACHOUT_GMAIL_ENABLED: "true",
  GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_GMAIL_REDIRECT_URI: "https://reachout.example/settings/gmail/callback",
  GMAIL_TOKEN_ENCRYPTION_KEY: KEY,
};

describe("Gmail configuration", () => {
  it("is off unless deliberately switched on (D-034), even when fully configured", () => {
    expect(gmailConfig({ ...GMAIL, REACHOUT_GMAIL_ENABLED: undefined })).toBeNull();
    for (const almost of ["", "1", "TRUE", "yes", "true "]) {
      expect(gmailConfig({ ...GMAIL, REACHOUT_GMAIL_ENABLED: almost })).toBeNull();
    }
    expect(gmailConfig(GMAIL)).not.toBeNull();
  });

  it("is off unless every setting is present and sound", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(gmailConfig({})).toBeNull();
    expect(gmailConfig({ REACHOUT_GMAIL_ENABLED: "true" })).toBeNull();
    expect(gmailConfig({ ...GMAIL, GOOGLE_CLIENT_SECRET: "" })).toBeNull();
    for (const uri of [
      "http://reachout.example/settings/gmail/callback",
      "https://reachout.example/somewhere/else",
      "https://reachout.example/settings/gmail/callback?next=//evil.example",
      "not a url",
    ]) {
      expect(gmailConfig({ ...GMAIL, GOOGLE_GMAIL_REDIRECT_URI: uri })).toBeNull();
    }
    expect(gmailConfig({ ...GMAIL, GMAIL_TOKEN_ENCRYPTION_KEY: "too-short" })).toBeNull();
  });

  it("works with exactly one callback, and keeps the previous key for opening only", () => {
    const previous = randomBytes(32).toString("base64");
    const config = gmailConfig({ ...GMAIL, GMAIL_TOKEN_ENCRYPTION_KEY_PREVIOUS: previous });
    expect(config?.redirectUri).toBe(GMAIL.GOOGLE_GMAIL_REDIRECT_URI);
    expect(config?.keys).toHaveLength(2);
    expect(
      gmailConfig({
        ...GMAIL,
        GOOGLE_GMAIL_REDIRECT_URI: "http://localhost:3001/settings/gmail/callback",
      }),
    ).not.toBeNull();
  });
});

describe("rate-limit secret", () => {
  it("is required in production, so nobody can compute someone else's key", () => {
    expect(() => rateLimitSecret({ NODE_ENV: "production" })).toThrow(/REACHOUT_RATE_LIMIT_SECRET/);
    expect(() =>
      rateLimitSecret({ NODE_ENV: "production", REACHOUT_RATE_LIMIT_SECRET: "short" }),
    ).toThrow();
    expect(
      rateLimitSecret({ NODE_ENV: "production", REACHOUT_RATE_LIMIT_SECRET: "x".repeat(40) }),
    ).toBe("x".repeat(40));
    expect(rateLimitSecret({ NODE_ENV: "development" })).toMatch(/development-only/);
  });

  it("counts by the first forwarded address", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});

describe("Content Security Policy", () => {
  it("in production: scripts only with this response's nonce, no eval, no framing, no plugins", () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = contentSecurityPolicy("bm9uY2U=", true);
    expect(csp).toContain("script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy("n", false)).not.toContain("upgrade-insecure-requests");
  });

  it("development adds eval for React's tooling, and only development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(contentSecurityPolicy("n", false)).toContain("'unsafe-eval'");
  });
});
