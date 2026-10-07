import type { UserId } from "@/domain/ids";
import type { RecordSet } from "@/domain/records";
import { createMemoryRepository } from "../memory/memory-repository";
import type { Repository } from "../repository";

/**
 * The seed dataset (or any fixture) held in memory: tests, design references,
 * the explicit development seed session (`REACHOUT_DEV_SEED`, never in
 * production) and the demo workspace (D-035, each demo its own copy of
 * fictional records). Writes last as long as the repository does. Never a
 * real account's records.
 */
export function createSeedRepository(records: RecordSet, userId: UserId): Repository {
  return createMemoryRepository(records, userId);
}
