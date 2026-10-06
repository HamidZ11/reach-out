import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Http } from "./http";
import { GmailError, json, request } from "./http";

/**
 * Google OAuth 2.0 for Gmail access only (D-031): the web-server flow with
 * PKCE and a state value, asking for one read-only scope. Reachout's own
 * sign-in stays with Supabase Auth; this never signs anyone in.
 */

/** Message headers and labels only: no bodies, no attachments, no changes. */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.metadata";

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";

export type OAuthClient = { clientId: string; clientSecret: string; redirectUri: string };

/** A random value Google returns unchanged, tying the callback to this browser's request. */
export function newState(): string {
  return randomBytes(32).toString("base64url");
}

/** PKCE: the verifier stays with us; Google only ever sees its hash. */
export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authorizationUrl(
  client: OAuthClient,
  { state, challenge }: { state: string; challenge: string },
): string {
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    // A refresh token, so Reachout can check later without asking again.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
};

/** The callback's code, for tokens. Throws "permission" if the Gmail scope wasn't granted. */
export async function exchangeCode(
  http: Http,
  client: OAuthClient,
  { code, verifier }: { code: string; verifier: string },
): Promise<{ accessToken: string; refreshToken: string; scopes: string[] }> {
  const tokens = await json<TokenResponse>(
    await request(http, TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: client.redirectUri,
      }),
    }),
  );
  const scopes = (tokens.scope ?? "").split(" ").filter(Boolean);
  if (!scopes.includes(GMAIL_SCOPE)) throw new GmailError("permission");
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new GmailError("unavailable", "Google returned no refresh token");
  }
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, scopes };
}

/** A short-lived access token from the stored refresh token. Never stored. */
export async function refreshAccess(
  http: Http,
  client: OAuthClient,
  refreshToken: string,
): Promise<string> {
  const tokens = await json<TokenResponse>(
    await request(http, TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: client.clientId,
        client_secret: client.clientSecret,
      }),
    }),
  );
  if (tokens.scope !== undefined && !tokens.scope.split(" ").includes(GMAIL_SCOPE)) {
    throw new GmailError("permission");
  }
  if (!tokens.access_token) throw new GmailError("unavailable", "Google returned no access token");
  return tokens.access_token;
}

/** Asks Google to forget the grant. Best effort: false if it couldn't. */
export async function revoke(http: Http, token: string): Promise<boolean> {
  try {
    const response = await request(http, REVOKE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
