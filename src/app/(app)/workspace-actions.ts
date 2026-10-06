import type { GmailActions } from "@/features/settings/gmail";
import type { SettingsActions } from "@/features/settings/operations";
import type { WorkspaceActions } from "@/features/workspace/outcome";
import {
  approveDraft,
  checkGmail,
  completeNextAction,
  connectGmail,
  createDraft,
  disconnectGmailAccount,
  markDraftSent,
  reviseDraft,
  saveGoals,
  saveProfile,
  snoozeNextAction,
  undo,
} from "./actions";

/** The Server Actions, as the plain objects the screens take. */
export const workspaceActions: WorkspaceActions = {
  completeNextAction,
  snoozeNextAction,
  createDraft,
  approveDraft,
  reviseDraft,
  markDraftSent,
  undo,
};

export const settingsActions: SettingsActions = { saveProfile, saveGoals };

export const gmailActions: GmailActions = {
  connect: connectGmail,
  check: checkGmail,
  disconnect: disconnectGmailAccount,
};
