import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SEED_USER_ID } from "@/data/seed/dataset";
import type { UserId } from "@/domain/ids";
import { UserIdSchema } from "@/domain/ids";
import { authMode } from "./config";
import { getSupabase } from "./supabase";

export { AuthNotConfiguredError } from "./config";

/**
 * Authentication boundary. Identity comes from Supabase Auth: the session is
 * read from cookies on the server and its JWT verified (`getClaims`), never
 * taken from anything the browser sends. The product profile is the `User`
 * record the repository reads for that identity.
 *
 * Outside production, REACHOUT_DEV_SEED=true runs every request as the seed
 * user instead (see config.ts). Unconfigured, it fails closed.
 */

export type Session = {
  userId: UserId;
  /** "supabase": a verified sign-in. "development": the explicit seed session. */
  method: "supabase" | "development";
  /** The sign-in address, from the verified token. */
  email?: string;
};

export const SIGN_IN_PATH = "/sign-in";

export const getSession = cache(async (): Promise<Session | null> => {
  const mode = authMode();
  if (mode.kind === "seed") return { userId: SEED_USER_ID, method: "development" };
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? undefined : data?.claims;
  const userId = UserIdSchema.safeParse(claims?.sub);
  if (!claims || !userId.success) return null;
  return {
    userId: userId.data,
    method: "supabase",
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
});

/**
 * Every data read and write goes through this, via `getRepository`. A request
 * without a signed-in user goes to sign in.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(SIGN_IN_PATH);
  return session;
}
