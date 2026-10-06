import "server-only";
import type { SecretKey } from "./secret-box";
import { secretKey } from "./secret-box";

/**
 * Where identity and records come from, decided once from the environment.
 *
 * - `supabase`: Supabase Auth and Postgres. Required in production.
 * - `seed`: the development seed session (one fictional student, in memory,
 *   not durable). Only when REACHOUT_DEV_SEED=true, and never in production:
 *   a production deployment that asks for it refuses to serve.
 *
 * Anything else fails closed: no session, no data.
 */
export type AuthMode = { kind: "supabase"; url: string; publishableKey: string } | { kind: "seed" };

export class AuthNotConfiguredError extends Error {
  constructor(message = "Authentication is not configured. See README.md › Local development.") {
    super(message);
    this.name = "AuthNotConfiguredError";
  }
}

type Env = Readonly<Record<string, string | undefined>>;

export function authMode(env: Env = process.env): AuthMode {
  if (env.REACHOUT_DEV_SEED !== undefined && env.REACHOUT_DEV_SEED !== "") {
    if (env.NODE_ENV === "production") {
      throw new AuthNotConfiguredError(
        "REACHOUT_DEV_SEED is for development only and is refused in production.",
      );
    }
    if (env.REACHOUT_DEV_SEED !== "true") {
      throw new AuthNotConfiguredError('REACHOUT_DEV_SEED must be exactly "true" or unset.');
    }
    return { kind: "seed" };
  }

  const url = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) throw new AuthNotConfiguredError();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AuthNotConfiguredError("SUPABASE_URL is not a URL.");
  }
  // Plain http only to this machine (a local Supabase); anything remote is https.
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new AuthNotConfiguredError("SUPABASE_URL must use https unless it is on this machine.");
  }
  return { kind: "supabase", url: parsed.origin, publishableKey };
}

/** The mode, or null when unconfigured, for places that must not throw (the proxy). */
export function authModeOrNull(env: Env = process.env): AuthMode | null {
  try {
    return authMode(env);
  } catch {
    return null;
  }
}

/**
 * Gmail (D-031) is off unless deliberately switched on (D-034):
 * REACHOUT_GMAIL_ENABLED=true and every setting below. Off, Settings says it
 * is coming later, nothing offers to connect, the callback does nothing, and
 * nothing reaches Google. Public launch keeps it off until Google has
 * verified the restricted scope; a Google test-user environment may turn it on.
 *
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: the OAuth web client.
 * - GOOGLE_GMAIL_REDIRECT_URI: exactly the callback registered with Google,
 *   https://<site>/settings/gmail/callback (http only on this machine).
 * - GMAIL_TOKEN_ENCRYPTION_KEY: 32 random bytes, base64, sealing refresh tokens.
 *   GMAIL_TOKEN_ENCRYPTION_KEY_PREVIOUS keeps the last key readable during a rotation.
 */
export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** The current key first; the previous one (if any) only opens. */
  keys: SecretKey[];
};

export function gmailConfig(env: Env = process.env): GmailConfig | null {
  if (env.REACHOUT_GMAIL_ENABLED !== "true") return null;
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_GMAIL_REDIRECT_URI?.trim();
  const key = env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!clientId || !clientSecret || !redirectUri || !key) {
    console.error(
      "Gmail is switched on but not fully configured, so it stays off. See .env.example.",
    );
    return null;
  }
  try {
    const url = new URL(redirectUri);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
    if (url.pathname !== "/settings/gmail/callback" || url.search || url.hash) return null;
    const keys = [secretKey(key)];
    const previous = env.GMAIL_TOKEN_ENCRYPTION_KEY_PREVIOUS?.trim();
    if (previous) keys.push(secretKey(previous));
    return { clientId, clientSecret, redirectUri: url.toString(), keys };
  } catch {
    console.error("Gmail's redirect URI or encryption key is invalid, so Gmail stays off.");
    return null;
  }
}

/**
 * The secret behind rate-limit keys (D-032): required in production, so an
 * attacker who knows someone's address can't compute their key and spend
 * their sign-in allowance.
 */
export function rateLimitSecret(env: Env = process.env): string {
  const secret = env.REACHOUT_RATE_LIMIT_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (env.NODE_ENV === "production") {
    throw new AuthNotConfiguredError(
      "REACHOUT_RATE_LIMIT_SECRET (32+ characters) is required in production.",
    );
  }
  return "development-only-rate-limit-secret-not-for-production";
}
