import "server-only";
import type { Repository } from "@/data/repository";
import { createSeedDataset, SEED_TIME_ZONE, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDateIn } from "@/domain/time";

/**
 * The approved design reference (src/app/prototypes) always shows the seed
 * dataset, whoever is signed in, so it stays the same frozen reference. It is
 * development only: in production the route 404s first, and this refuses too.
 */
export function getDesignReferenceRepository(now = new Date()): Repository {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The design reference is not available in production");
  }
  return createSeedRepository(createSeedDataset(calendarDateIn(now, SEED_TIME_ZONE)), SEED_USER_ID);
}
