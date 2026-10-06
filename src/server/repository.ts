import "server-only";
import { cache } from "react";
import type { Repository } from "@/data/repository";
import { RepositoryError } from "@/data/repository";
import { createSeedDataset, SEED_TIME_ZONE } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import type { ReachoutClient } from "@/data/supabase/supabase-repository";
import { createSupabaseRepository, repositoryError } from "@/data/supabase/supabase-repository";
import type { CalendarDate } from "@/domain/time";
import { calendarDateIn } from "@/domain/time";
import type { Session } from "./auth";
import { requireSession } from "./auth";
import { getSupabase } from "./supabase";

/**
 * The single place that decides where records come from. Routes and Server
 * Actions call this; nothing else constructs a Repository.
 *
 * - A Supabase session: the durable repository, scoped to the user's
 *   workspace, which is created on first sign-in.
 * - The development seed session: the seed dataset in memory for this server
 *   process. Changes last until it restarts (or the day changes).
 */
export const getRepository = cache(async (): Promise<Repository> => {
  const session = await requireSession();
  if (session.method === "development") return developmentRepository();
  const supabase = await getSupabase();
  const workspaceId = await workspaceFor(supabase, session);
  return createSupabaseRepository(supabase, { userId: session.userId, workspaceId });
});

/**
 * The signed-in user's workspace. On first sign-in, the database creates the
 * profile, the personal workspace and its membership in one idempotent call,
 * so racing first requests still make exactly one of each.
 */
async function workspaceFor(supabase: ReachoutClient, session: Session): Promise<string> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("profile_id", session.userId)
    .limit(1)
    .maybeSingle();
  if (error) throw repositoryError(error);
  if (data) return data.workspace_id;

  const created = await supabase.rpc("bootstrap_account", {
    p_name: provisionalName(session.email),
    // Onboarding sets the real one from the browser; until then, UTC.
    p_time_zone: "UTC",
    p_at: new Date().toISOString(),
  });
  if (created.error) throw repositoryError(created.error);
  if (!created.data) throw new RepositoryError("unavailable", "No workspace was created");
  return created.data;
}

/**
 * Onboarding doesn't ask for a name, so a new account starts with the part of
 * the sign-in address before the @. It is the user's own text, and Settings
 * changes it.
 */
export function provisionalName(email: string | undefined): string {
  const local = email?.split("@")[0]?.trim();
  return local || "You";
}

const DEVELOPMENT_STORE = Symbol.for("reachout.development-seed");
type DevelopmentStore = { anchor: CalendarDate; repository: Repository };

function developmentRepository(): Repository {
  const anchor = calendarDateIn(new Date(), SEED_TIME_ZONE);
  const holder = globalThis as typeof globalThis & { [DEVELOPMENT_STORE]?: DevelopmentStore };
  const existing = holder[DEVELOPMENT_STORE];
  if (existing?.anchor === anchor) return existing.repository;
  const dataset = createSeedDataset(anchor);
  const user = dataset.users[0];
  if (!user) throw new Error("The seed dataset has no user");
  const repository = createSeedRepository(dataset, user.id);
  holder[DEVELOPMENT_STORE] = { anchor, repository };
  return repository;
}
