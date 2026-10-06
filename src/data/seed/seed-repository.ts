import type { UserId } from "@/domain/ids";
import type { RecordSet } from "@/domain/records";
import { createMemoryRepository } from "../memory/memory-repository";
import type { Repository } from "../repository";

/**
 * The seed dataset (or any fixture) held in memory: tests, design references,
 * and the explicit development seed session (`REACHOUT_DEV_SEED`). Writes last
 * as long as the repository does. Never used in production.
 */
export function createSeedRepository(records: RecordSet, userId: UserId): Repository {
  return createMemoryRepository(records, userId);
}
