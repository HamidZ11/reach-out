import "server-only";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getDesignReferenceRepository } from "@/server/design-reference";
import type { Snapshot } from "./snapshot";

/** The seed dataset through the production loader: the frozen design reference's data. */
export async function loadSnapshot(now = new Date()): Promise<Snapshot> {
  return loadWorkspace(getDesignReferenceRepository(now), now, { research: true });
}
