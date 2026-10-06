// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Http } from "./http";
import { GmailError } from "./http";
import { authorizationUrl, exchangeCode, GMAIL_SCOPE, pkce, refreshAccess, revoke } from "./oauth";

const client = {
  clientId: "client.apps.googleusercontent.com",
  clientSecret: "secret",
  redirectUri: "https://reachout.example/settings/gmail/callback",
};

const reply = (status: number, body: unknown): Http =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as Http;

describe("Gmail OAuth", () => {
  it("asks for one read-only scope, offline, with state and PKCE, back to the exact callback", () => {
    const { verifier, challenge } = pkce();
    const url = new URL(authorizationUrl(client, { state: "s1", challenge }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("scope")).toBe(GMAIL_SCOPE);
    expect(GMAIL_SCOPE).toBe("https://www.googleapis.com/auth/gmail.metadata");
    expect(p.get("redirect_uri")).toBe(client.redirectUri);
    expect(p.get("state")).toBe("s1");
    expect(p.get("code_challenge")).toBe(challenge);
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("access_type")).toBe("offline");
    expect(url.toString()).not.toContain(verifier);
    expect(url.toString()).not.toContain(client.clientSecret);
  });

  it("refuses a grant without the Gmail scope", async () => {
    const http = reply(200, {
      access_token: "a",
      refresh_token: "r",
      scope: "openid email",
    });
    await expect(exchangeCode(http, client, { code: "c", verifier: "v" })).rejects.toMatchObject({
      kind: "permission",
    });
  });

  it("returns tokens for a good grant", async () => {
    const http = reply(200, { access_token: "a", refresh_token: "r", scope: GMAIL_SCOPE });
    await expect(exchangeCode(http, client, { code: "c", verifier: "v" })).resolves.toEqual({
      accessToken: "a",
      refreshToken: "r",
      scopes: [GMAIL_SCOPE],
    });
  });

  it("a revoked refresh token says so; outages and timeouts are 'unavailable'", async () => {
    await expect(
      refreshAccess(reply(400, { error: "invalid_grant" }), client, "r"),
    ).rejects.toMatchObject({
      kind: "revoked",
    });
    await expect(refreshAccess(reply(503, {}), client, "r")).rejects.toMatchObject({
      kind: "unavailable",
    });
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as Http;
    const error = await refreshAccess(down, client, "1//distinctive-refresh-token").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(GmailError);
    expect((error as GmailError).kind).toBe("unavailable");
    // Nothing secret travels in the error.
    expect(String((error as Error).message)).not.toContain("distinctive-refresh-token");
  });

  it("revoking is best effort", async () => {
    await expect(revoke(reply(200, {}), "r")).resolves.toBe(true);
    await expect(revoke(reply(400, {}), "r")).resolves.toBe(false);
    const down = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as Http;
    await expect(revoke(down, "r")).resolves.toBe(false);
  });
});
