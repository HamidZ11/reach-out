import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { Database } from "@/data/supabase/database.types";
import type { ReachoutClient } from "@/data/supabase/supabase-repository";
import { createSupabaseRepository } from "@/data/supabase/supabase-repository";
import { UserIdSchema } from "@/domain/ids";

/**
 * Real accounts on the local Supabase, signed in the way Reachout signs people
 * in: an email link (generated here instead of read from an inbox) verified
 * by Supabase Auth. The service key only creates the link; every query after
 * that runs as the signed-in user, under row-level security.
 */

const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function anonymousClient(): ReachoutClient {
  const { url, publishableKey } = inject("supabase");
  return createClient<Database>(url, publishableKey, OPTIONS);
}

export async function signedInAccount(label = "student") {
  const { url, publishableKey, serviceRoleKey } = inject("supabase");
  const admin = createClient<Database>(url, serviceRoleKey, OPTIONS);
  const email = `${label}.${crypto.randomUUID().slice(0, 8)}@reachout.test`;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;

  const client = createClient<Database>(url, publishableKey, OPTIONS);
  const { data, error } = await client.auth.verifyOtp({
    type: "email",
    token_hash: link.data.properties.hashed_token,
  });
  if (error || !data.user) throw error ?? new Error("No user after verifying the link");
  return { client, email, userId: UserIdSchema.parse(data.user.id) };
}

/** A signed-in account with its profile and workspace, as first sign-in creates them. */
export async function bootstrappedAccount(label?: string) {
  const account = await signedInAccount(label);
  const { data: workspaceId, error } = await account.client.rpc("bootstrap_account", {
    p_name: label ?? "Student",
    p_time_zone: "UTC",
    p_at: new Date().toISOString(),
  });
  if (error || !workspaceId) throw error ?? new Error("No workspace");
  const repository = createSupabaseRepository(account.client, {
    userId: account.userId,
    workspaceId,
  });
  return { ...account, workspaceId, repository };
}
