import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SEED_USER_ID } from "@/data/seed/dataset";
import type { UserId } from "@/domain/ids";
import { UserIdSchema } from "@/domain/ids";
import { authMode } from "./config";
import { currentDemo, DEMO_USER_ID } from "./demo";
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
 *
 * A browser that chose "Try the demo" is in the demo workspace (D-035): a
 * cookie this server signed, checked here, which selects in-memory fictional
 * records and never Supabase. It comes first because it was chosen: signing
 * in for real ends it.
 */

export type Session =
  /** A verified sign-in. */
  | { method: "supabase"; userId: UserId; /** From the verified token. */ email?: string }
  /** The explicit development seed session. */
  | { method: "development"; userId: UserId }
  /** The demo workspace: always the fictional student; `demoId` chooses which copy. */
  | { method: "demo"; userId: UserId; demoId: string };

export const SIGN_IN_PATH = "/sign-in";

export const getSession = cache(async (): Promise<Session | null> => {
  const demoId = await currentDemo();
  if (demoId) return { method: "demo", userId: DEMO_USER_ID, demoId };
  const mode = authMode();
  if (mode.kind === "seed") return { method: "development", userId: SEED_USER_ID };
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? undefined : data?.claims;
  const userId = UserIdSchema.safeParse(claims?.sub);
  if (!claims || !userId.success) return null;
  return {
    method: "supabase",
    userId: userId.data,
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
