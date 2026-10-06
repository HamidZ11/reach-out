"use server";

import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { Repository } from "@/data/repository";
import { RepositoryError } from "@/data/repository";
import type { GmailOutcome } from "@/features/settings/gmail";
import type { SettingsOutcome } from "@/features/settings/operations";
import {
  GoalsInput,
  ProfileInput,
  saveGoalsStep,
  saveProfileStep,
} from "@/features/settings/operations";
import {
  approveDraftStep,
  CompleteInput,
  completeNextActionStep,
  createDraftStep,
  DraftCreateInput,
  DraftReferenceInput,
  DraftReviseInput,
  markDraftSentStep,
  reviseDraftStep,
  SnoozeInput,
  snoozeNextActionStep,
  UndoInput,
  undoStep,
} from "@/features/workspace/operations";
import type { Outcome } from "@/features/workspace/outcome";
import {
  disconnectGmail,
  gmailStatus,
  startGmailConnection,
  syncGmailForUser,
} from "@/server/gmail";
import { getRepository } from "@/server/repository";

/**
 * The signed-in area's Server Actions. Each one is reachable by a direct POST,
 * so each parses its input, reads the user from the session (never from the
 * input), and runs one workflow step through that user's repository. A lapsed
 * session goes to sign in. After a saved change, the router refreshes so the
 * shell (Today's dot) reflects it.
 */

async function run<S extends z.ZodType, T extends { ok: boolean }>(
  schema: S,
  input: unknown,
  step: (repository: Repository, data: z.infer<S>) => Promise<T>,
  invalid: T,
  unavailable: T,
): Promise<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const result = await step(await getRepository(), parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    unstable_rethrow(error); // a redirect to sign in, from requireSession
    if (error instanceof RepositoryError) {
      if (error.code === "unauthenticated") redirect("/sign-in");
      // The data source couldn't be reached: say so, rather than fail the request.
      console.error("A Server Action couldn't reach the data source", error.code);
      return unavailable;
    }
    throw error;
  }
}

const INVALID: Outcome = { ok: false, problem: "invalid" };
const UNAVAILABLE: Outcome = { ok: false, problem: "unavailable" };
const INVALID_SETTINGS: SettingsOutcome = { ok: false, problem: "invalid" };
const UNAVAILABLE_SETTINGS: SettingsOutcome = { ok: false, problem: "unavailable" };
const now = () => new Date();

export async function completeNextAction(input: z.input<typeof CompleteInput>): Promise<Outcome> {
  return run(
    CompleteInput,
    input,
    (r, d) => completeNextActionStep(r, d, now()),
    INVALID,
    UNAVAILABLE,
  );
}

export async function snoozeNextAction(input: z.input<typeof SnoozeInput>): Promise<Outcome> {
  return run(SnoozeInput, input, (r, d) => snoozeNextActionStep(r, d, now()), INVALID, UNAVAILABLE);
}

export async function createDraft(input: z.input<typeof DraftCreateInput>): Promise<Outcome> {
  return run(DraftCreateInput, input, (r, d) => createDraftStep(r, d, now()), INVALID, UNAVAILABLE);
}

export async function approveDraft(input: z.input<typeof DraftReferenceInput>): Promise<Outcome> {
  return run(
    DraftReferenceInput,
    input,
    (r, d) => approveDraftStep(r, d, now()),
    INVALID,
    UNAVAILABLE,
  );
}

export async function reviseDraft(input: z.input<typeof DraftReviseInput>): Promise<Outcome> {
  return run(DraftReviseInput, input, (r, d) => reviseDraftStep(r, d, now()), INVALID, UNAVAILABLE);
}

export async function markDraftSent(input: z.input<typeof DraftReferenceInput>): Promise<Outcome> {
  return run(
    DraftReferenceInput,
    input,
    (r, d) => markDraftSentStep(r, d, now()),
    INVALID,
    UNAVAILABLE,
  );
}

export async function undo(input: z.input<typeof UndoInput>): Promise<Outcome> {
  return run(UndoInput, input, (r, d) => undoStep(r, d), INVALID, UNAVAILABLE);
}

export async function saveProfile(input: z.input<typeof ProfileInput>): Promise<SettingsOutcome> {
  return run(
    ProfileInput,
    input,
    (r, d) => saveProfileStep(r, d, now()),
    INVALID_SETTINGS,
    UNAVAILABLE_SETTINGS,
  );
}

export async function saveGoals(input: z.input<typeof GoalsInput>): Promise<SettingsOutcome> {
  return run(
    GoalsInput,
    input,
    (r, d) => saveGoalsStep(r, d, now()),
    INVALID_SETTINGS,
    UNAVAILABLE_SETTINGS,
  );
}

/* ——— Gmail (D-031): read-only correspondence tracking ——— */

/** Leaves for Google's consent screen; answers only if it can't. */
export async function connectGmail(): Promise<{ ok: false; message: string } | void> {
  const start = await startGmailConnection();
  if ("url" in start) redirect(start.url as Route);
  return {
    ok: false,
    message:
      start.problem === "rate_limited"
        ? "That's a lot of tries. Wait a little, then connect Gmail again."
        : "Gmail isn't available right now.",
  };
}

/** "Check now": a sync when the user asks, limited so it can't be hammered. */
export async function checkGmail(): Promise<GmailOutcome> {
  try {
    const result = await syncGmailForUser({ now: true });
    const { connection } = await gmailStatus();
    if ("recorded" in result && result.recorded > 0) refresh();
    switch (result.status) {
      case "synced":
      case "history_reset":
        return {
          ok: true,
          connection,
          message:
            result.recorded === 0
              ? "Checked Gmail. Nothing new with people you track."
              : `Checked Gmail. ${result.recorded === 1 ? "One message" : `${result.recorded} messages`} added to your history.`,
        };
      case "needs_reconnect":
        return { ok: true, connection, message: "Gmail needs reconnecting." };
      case "rate_limited":
        return { ok: false, message: "Checked very recently. Try again in a few minutes." };
      case "skipped":
        return { ok: true, connection, message: "Gmail is already being checked." };
      case "disabled":
        return { ok: false, message: "Gmail isn't available on this site yet." };
      case "unavailable":
        return {
          ok: false,
          message: "Gmail couldn't be reached. Nothing changed; try again soon.",
        };
    }
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: "Gmail couldn't be reached. Nothing changed; try again soon." };
  }
}

/** Forgets the Gmail connection. History already recorded stays. */
export async function disconnectGmailAccount(): Promise<GmailOutcome> {
  try {
    const { revoked } = await disconnectGmail();
    refresh();
    return {
      ok: true,
      connection: null,
      message: revoked
        ? "Gmail disconnected. What it added to your history stays."
        : "Gmail disconnected here. Google couldn't be told, so remove Reachout in your Google account's security settings too.",
    };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: "Gmail couldn't be disconnected just now. Try again." };
  }
}

/**
 * On entering the app: a sync if one is due (at most every ten minutes).
 * Runs after the page has loaded, never blocks it, and never fails it.
 */
export async function syncGmailOnEntry(): Promise<void> {
  try {
    const result = await syncGmailForUser({ now: false });
    if ("recorded" in result && result.recorded > 0) refresh();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Background Gmail sync failed");
  }
}
