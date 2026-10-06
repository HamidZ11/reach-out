"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { Repository } from "@/data/repository";
import { RepositoryError } from "@/data/repository";
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
