import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { GmailConnection } from "@/data/repository";
import { gmailApi } from "@/integrations/gmail/api";
import { GmailError } from "@/integrations/gmail/http";
import {
  authorizationUrl,
  exchangeCode,
  newState,
  pkce,
  refreshAccess,
  revoke,
} from "@/integrations/gmail/oauth";
import type { GmailSyncResult } from "@/integrations/gmail/sync";
import { syncGmail } from "@/integrations/gmail/sync";
import { instant } from "@/domain/time";
import { requireSession } from "./auth";
import type { GmailConfig } from "./config";
import { gmailConfig } from "./config";
import { allowed } from "./rate-limit";
import { getRepository } from "./repository";
import { open, seal } from "./secret-box";

/**
 * Gmail for the signed-in user (D-031), on the server only. Tokens are
 * sealed before they reach the database and are never sent to a browser,
 * logged, or put in an error. The rest of Reachout works the same with Gmail
 * off, unconfigured, or failing.
 */

/** Where Google sends the user back. Must match GOOGLE_GMAIL_REDIRECT_URI exactly. */
export const GMAIL_CALLBACK_PATH = "/settings/gmail/callback";

const HANDSHAKE_COOKIE = "reachout-gmail-oauth";
const HANDSHAKE_MAX_AGE_S = 10 * 60;

/** How long an automatic sync waits after the last one. */
export const SYNC_INTERVAL_S = 10 * 60;

const tokenContext = (userId: string) => `reachout:gmail-refresh-token:${userId}`;
const handshakeContext = (userId: string) => `reachout:gmail-oauth:${userId}`;

export type GmailStatus = {
  /** Gmail is configured on this deployment. */
  available: boolean;
  connection: GmailConnection | null;
};

export async function gmailStatus(): Promise<GmailStatus> {
  const config = gmailConfig();
  const session = await requireSession();
  if (!config || session.method !== "supabase") return { available: false, connection: null };
  const repository = await getRepository();
  return { available: true, connection: await repository.gmail.connection() };
}

export type ConnectStart = { url: string } | { problem: "unavailable" | "rate_limited" };

/** The Google consent URL, with this browser's handshake sealed in a short-lived cookie. */
export async function startGmailConnection(): Promise<ConnectStart> {
  const config = gmailConfig();
  const session = await requireSession();
  if (!config || session.method !== "supabase") return { problem: "unavailable" };
  if (!(await allowed("gmail_connect", session.userId, { whenUnavailable: "refuse" }))) {
    return { problem: "rate_limited" };
  }
  const state = newState();
  const { verifier, challenge } = pkce();
  const [key] = config.keys;
  const handshake = seal(
    JSON.stringify({ state, verifier, issuedAt: Date.now() }),
    key!,
    handshakeContext(session.userId),
  );
  const store = await cookies();
  store.set(HANDSHAKE_COOKIE, `${handshake.keyId}:${handshake.sealed}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: GMAIL_CALLBACK_PATH,
    maxAge: HANDSHAKE_MAX_AGE_S,
  });
  return { url: authorizationUrl(client(config), { state, challenge }) };
}

export type ConnectResult =
  | "connected"
  | "denied"
  | "invalid"
  | "permission"
  | "unavailable"
  /** Gmail is switched off on this deployment: nothing happened. */
  | "disabled";

/**
 * Google's callback. The state must match this browser's handshake, for the
 * same signed-in user, within ten minutes; the Gmail scope must have been
 * granted. Only then is the refresh token sealed and stored.
 */
export async function finishGmailConnection(params: URLSearchParams): Promise<ConnectResult> {
  const config = gmailConfig();
  const session = await requireSession();
  const store = await cookies();
  const raw = store.get(HANDSHAKE_COOKIE)?.value;
  store.set(HANDSHAKE_COOKIE, "", { path: GMAIL_CALLBACK_PATH, maxAge: 0 });
  if (!config || session.method !== "supabase") return "disabled";
  if (params.get("error")) return "denied";

  const handshake = readHandshake(raw, config, session.userId);
  const state = params.get("state") ?? "";
  const code = params.get("code");
  if (!handshake || !code || !sameText(state, handshake.state)) return "invalid";
  if (Date.now() - handshake.issuedAt > HANDSHAKE_MAX_AGE_S * 1000) return "invalid";

  try {
    const tokens = await exchangeCode(fetch, client(config), {
      code,
      verifier: handshake.verifier,
    });
    const profile = await gmailApi(fetch, tokens.accessToken).profile();
    const repository = await getRepository();
    await repository.gmail.connect({
      emailAddress: profile.emailAddress,
      scopes: tokens.scopes,
      credential: seal(tokens.refreshToken, config.keys[0]!, tokenContext(session.userId)),
      historyCursor: profile.historyId,
      at: instant(new Date().toISOString()),
    });
    return "connected";
  } catch (error) {
    if (error instanceof GmailError && error.kind === "permission") return "permission";
    console.error(
      "Connecting Gmail failed",
      error instanceof GmailError ? error.kind : "unexpected",
    );
    return "unavailable";
  }
}

/**
 * Forgets the connection and its credentials (recorded history stays), then
 * asks Google to revoke the grant. If Google can't be reached, the local
 * credentials are gone anyway.
 */
export async function disconnectGmail(): Promise<{ revoked: boolean }> {
  const session = await requireSession();
  const repository = await getRepository();
  const sealed = await repository.gmail.disconnect();
  const config = gmailConfig();
  if (!sealed || !config) return { revoked: !sealed };
  try {
    return {
      revoked: await revoke(fetch, open(sealed, config.keys, tokenContext(session.userId))),
    };
  } catch {
    return { revoked: false };
  }
}

export type SyncAnswer = GmailSyncResult | { status: "rate_limited" } | { status: "disabled" };

/** A sync for the signed-in user: when due, or now when they ask ("Check now"). */
export async function syncGmailForUser({ now }: { now: boolean }): Promise<SyncAnswer> {
  const config = gmailConfig();
  const session = await requireSession();
  if (!config || session.method !== "supabase") return { status: "disabled" };
  if (now && !(await allowed("gmail_check", session.userId, { whenUnavailable: "refuse" }))) {
    return { status: "rate_limited" };
  }
  const repository = await getRepository();
  return syncGmail(
    {
      repository,
      openCredential: (credential) => open(credential, config.keys, tokenContext(session.userId)),
      accessToken: (refreshToken) => refreshAccess(fetch, client(config), refreshToken),
      api: (accessToken) => gmailApi(fetch, accessToken),
      now: () => new Date(),
    },
    { minIntervalSeconds: now ? 0 : SYNC_INTERVAL_S },
  );
}

function client(config: GmailConfig) {
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  };
}

function readHandshake(raw: string | undefined, config: GmailConfig, userId: string) {
  if (!raw) return null;
  const at = raw.indexOf(":");
  try {
    const value = JSON.parse(
      open(
        { keyId: raw.slice(0, at), sealed: raw.slice(at + 1) },
        config.keys,
        handshakeContext(userId),
      ),
    ) as { state?: unknown; verifier?: unknown; issuedAt?: unknown };
    if (
      typeof value.state !== "string" ||
      typeof value.verifier !== "string" ||
      typeof value.issuedAt !== "number"
    ) {
      return null;
    }
    return { state: value.state, verifier: value.verifier, issuedAt: value.issuedAt };
  } catch {
    return null;
  }
}

/** Compares in constant time, so the state can't be guessed byte by byte. */
function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}
