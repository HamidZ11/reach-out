import "server-only";

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
