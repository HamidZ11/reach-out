import { createMemoryRepository } from "@/data/memory/memory-repository";
import type { Repository } from "@/data/repository";
import type { RecordSet } from "@/domain/records";
import type { WorkspaceActions } from "./outcome";
import {
  approveDraftStep,
  completeNextActionStep,
  createDraftStep,
  markDraftSentStep,
  reviseDraftStep,
  snoozeNextActionStep,
  undoStep,
} from "./operations";
import type { Workspace } from "./records";

/**
 * Session-only actions: the real workflow steps and domain rules over an
 * in-memory copy of one workspace. NOTHING IS SAVED. For component tests and
 * the design references in src/app/prototypes only; production routes pass
 * Server Actions instead (enforced by app/boundaries.test.ts).
 *
 * The clock is the snapshot's own, so a test or a design reference behaves the
 * same on any day.
 */
export function createLocalActions(
  snapshot: Workspace,
  /** The repository the snapshot was read from, so a test can read changes back. */
  repository: Repository = createMemoryRepository(recordsOf(snapshot), snapshot.user.id),
): WorkspaceActions {
  return actionsFor(repository, () => new Date(snapshot.now));
}

/** The workflow steps bound to one repository and clock, without a network in between. */
export function actionsFor(repository: Repository, now: () => Date): WorkspaceActions {
  return {
    completeNextAction: (input) => completeNextActionStep(repository, input, now()),
    snoozeNextAction: (input) => snoozeNextActionStep(repository, input, now()),
    createDraft: (input) => createDraftStep(repository, input, now()),
    approveDraft: (input) => approveDraftStep(repository, input, now()),
    reviseDraft: (input) => reviseDraftStep(repository, input, now()),
    markDraftSent: (input) => markDraftSentStep(repository, input, now()),
    undo: (input) => undoStep(repository, input),
  };
}

function recordsOf(w: Workspace): RecordSet {
  return {
    users: [w.user],
    companies: w.companies,
    people: w.people,
    opportunities: w.opportunities,
    interactions: w.interactions,
    drafts: w.drafts,
    nextActions: w.nextActions,
    sourceFacts: w.facts,
    interpretations: w.interpretations,
  };
}
