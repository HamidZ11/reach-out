import "server-only";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getRepository } from "@/server/repository";
import type { Snapshot } from "./snapshot";

/** Reads the session user's records through the Repository — the production path. */
export async function loadSnapshot(now = new Date()): Promise<Snapshot> {
  return loadWorkspace(await getRepository(), now, { research: true });
}
