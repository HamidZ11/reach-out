import "server-only";
import { cache } from "react";
import { SEED_USER_ID } from "@/data/seed/dataset";
import type { UserId } from "@/domain/ids";

/**
 * Authentication boundary. NOT OPERATIONAL: no identity provider is wired.
 *
 * Outside production, every request runs as the seed user so the app can be
 * developed against seed data. In production this module refuses to produce a
 * session, so an unconfigured deployment fails closed instead of serving
 * someone else's data.
 *
 * When a provider is added (Supabase Auth is the likely choice — see
 * ROADMAP.md), only this file changes: read the provider session from cookies
 * and map it to a Session. Everything else depends on `requireSession`.
 */

export type Session = {
  userId: UserId;
  /** How this session was established. Only the development stub exists today. */
  method: "development";
};

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("No authentication provider is configured. See ARCHITECTURE.md › Authentication.");
    this.name = "AuthNotConfiguredError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("No signed-in user.");
    this.name = "UnauthenticatedError";
  }
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (process.env.NODE_ENV === "production") throw new AuthNotConfiguredError();
  return { userId: SEED_USER_ID, method: "development" };
});

/**
 * Every data read goes through this, via `getRepository`. Once sign-in exists,
 * an unauthenticated request redirects to it instead of throwing.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  return session;
}
