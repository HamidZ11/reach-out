import type { WorkspaceActions } from "@/features/workspace/outcome";

const unused = (name: string) => () =>
  Promise.reject(new Error(`${name} was called in a read-only test`));

/** For tests that only read: any action fails loudly. */
export const READ_ONLY_ACTIONS: WorkspaceActions = {
  completeNextAction: unused("completeNextAction"),
  snoozeNextAction: unused("snoozeNextAction"),
  createDraft: unused("createDraft"),
  approveDraft: unused("approveDraft"),
  reviseDraft: unused("reviseDraft"),
  markDraftSent: unused("markDraftSent"),
  undo: unused("undo"),
};
