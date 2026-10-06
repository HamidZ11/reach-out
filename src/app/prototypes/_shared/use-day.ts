import { useState } from "react";
import { createLocalActions } from "@/features/workspace/local-actions";
import type { Workspace } from "@/features/workspace/records";
import { useWorkspace } from "@/features/workspace/use-workspace";

/**
 * The prototypes use the production workspace state with session-only
 * actions: design references over seed data, never saved.
 */
export function useDay(snapshot: Workspace) {
  const [actions] = useState(() => createLocalActions(snapshot));
  return useWorkspace(snapshot, actions);
}
export type { WorkspaceState as Day } from "@/features/workspace/use-workspace";
