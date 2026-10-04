import "server-only";
import { cache } from "react";
import type { Repository } from "@/data/repository";
import { createSeedDataset, SEED_TIME_ZONE } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDateIn } from "@/domain/time";
import { requireSession } from "./auth";

/**
 * The single place that decides where records come from. Routes and server
 * actions call this; nothing else constructs a Repository.
 *
 * Today: seed data, regenerated relative to the current date.
 * Later: a Postgres/Supabase repository scoped to the same session user.
 */
export const getRepository = cache(async (): Promise<Repository> => {
  const session = await requireSession();
  const anchor = calendarDateIn(new Date(), SEED_TIME_ZONE);
  return createSeedRepository(createSeedDataset(anchor), session.userId);
});
