import { describe, expect, it } from "vitest";
import type { Repository } from "@/data/repository";
import { RepositoryError } from "@/data/repository";
import { approveDraft, markDraftSent } from "@/domain/draft";
import { DomainError } from "@/domain/errors";
import type { DraftId, InteractionId } from "@/domain/ids";
import { MessageSentSchema } from "@/domain/interaction";
import { calendarDateIn, instant } from "@/domain/time";
import { deriveToday } from "@/domain/today";
import { completeOnboardingStep } from "@/features/onboarding/complete";
import type { Answers } from "@/features/onboarding/questions";
import { EMPTY } from "@/features/onboarding/questions";
import { saveGoalsStep, saveProfileStep } from "@/features/settings/operations";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import {
  approveDraftStep,
  completeNextActionStep,
  createDraftStep,
  markDraftSentStep,
  reviseDraftStep,
  snoozeNextActionStep,
  undoStep,
} from "@/features/workspace/operations";
import type { Outcome } from "@/features/workspace/outcome";

/**
 * What every Repository must do, run against each implementation: the
 * in-memory one in `pnpm test`, Supabase in `pnpm test:db`. It drives the same
 * workflow steps the Server Actions run, and checks what was saved by reading
 * it back.
 *
 * `fresh` returns a repository for a new account: a profile, no records.
 */

export const ONBOARDING_ANSWERS: Answers = {
  ...EMPTY,
  objective: "internship",
  roles: ["Software engineering"],
  sectors: ["Fintech"],
  locations: ["London"],
  opportunityTitle: "Platform Engineering Summer Internship",
  organisation: "Halden Robotics",
  deadline: "",
  personName: "Priya Natarajan",
  personRole: "Graduate engineer",
  source: "alumni_network",
  whyRelevant: "Did this internship last year.",
  action: 0,
  due: 0,
};

/** A new account, through onboarding: one company, person, opportunity and next action. */
export async function onboarded(repository: Repository, now: Date) {
  const result = await completeOnboardingStep(
    repository,
    { answers: ONBOARDING_ANSWERS, timeZone: "Europe/London" },
    now,
  );
  if (!result.ok) throw new Error(`Onboarding failed: ${result.problem}`);
  return result.workspace;
}

function changed(outcome: Outcome) {
  if (!outcome.ok) throw new Error(`Expected a saved change, got ${outcome.problem}`);
  return outcome;
}

/** A clock that moves on a second at a time, as real actions would. */
export function steppingClock(start = Date.parse("2026-10-06T09:00:00.000Z")) {
  let at = start;
  return () => new Date((at += 1000));
}

export function repositoryContract(name: string, fresh: () => Promise<Repository>) {
  describe(`${name}: the Repository contract`, () => {
    it("a new account has a profile and no records, and is the signed-in user's", async () => {
      const repository = await fresh();
      const user = await repository.user.get();
      expect(user.id).toBe(repository.userId);
      expect(user.onboardingCompletedAt).toBeUndefined();
      const workspace = await loadWorkspace(repository, new Date(), { research: true });
      expect(workspace.people).toEqual([]);
      expect(workspace.nextActions).toEqual([]);
      expect(deriveToday(workspace)).toEqual([]);
    });

    it("onboarding saves goals and the first records together, exactly once", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const workspace = await onboarded(repository, now());
      expect(workspace.user.goals?.targetRoles).toEqual(["Software engineering"]);
      expect(workspace.companies.map((c) => c.name)).toEqual(["Halden Robotics"]);
      expect(workspace.people.map((p) => p.name)).toEqual(["Priya Natarajan"]);
      expect(workspace.opportunities[0]?.personIds).toEqual([workspace.people[0]?.id]);
      expect(deriveToday(workspace).map((i) => i.kind)).toEqual(["upcoming_action"]);

      const again = await completeOnboardingStep(
        repository,
        { answers: ONBOARDING_ANSWERS, timeZone: "Europe/London" },
        now(),
      );
      expect(again).toEqual({ ok: false, problem: "onboarding_complete" });
      const after = await loadWorkspace(repository, now());
      expect(after.people).toHaveLength(1);
      expect(after.companies).toHaveLength(1);
      expect(after.nextActions).toHaveLength(1);
    });

    it("unknown or malformed ids name nothing", async () => {
      const repository = await fresh();
      await onboarded(repository, new Date());
      for (const id of ["prs_01", "", "00000000-0000-4000-8000-000000000000"]) {
        expect(await repository.people.get(id as never)).toBeNull();
        expect(await repository.drafts.get(id as never)).toBeNull();
        expect(await repository.nextActions.get(id as never)).toBeNull();
      }
    });

    it("draft → approval → send it yourself → mark sent, with each step saved", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const { people } = await onboarded(repository, now());
      const priya = people[0]!;

      const created = changed(
        await createDraftStep(
          repository,
          { personId: priya.id, channel: "email", subject: "Hello", body: "Hi Priya" },
          now(),
        ),
      );
      const draft = created.changes.drafts![0]!;
      expect(draft.status).toBe("awaiting_approval");
      expect(draft.origin).toBe("user");

      const approved = changed(
        await approveDraftStep(repository, { id: draft.id, expected: draft.updatedAt }, now()),
      ).changes.drafts![0]!;
      expect(approved.status).toBe("approved");

      // Approval covers the exact content: an edit sends it back for approval.
      const edited = changed(
        await reviseDraftStep(
          repository,
          { id: draft.id, body: "Hi Priya, a shorter note.", expected: approved.updatedAt },
          now(),
        ),
      ).changes.drafts![0]!;
      expect(edited.status).toBe("awaiting_approval");
      expect(await repository.drafts.get(draft.id)).toMatchObject({
        status: "awaiting_approval",
        body: "Hi Priya, a shorter note.",
      });

      const reapproved = changed(
        await approveDraftStep(repository, { id: draft.id, expected: edited.updatedAt }, now()),
      ).changes.drafts![0]!;
      const sent = changed(
        await markDraftSentStep(
          repository,
          { id: draft.id, expected: reapproved.updatedAt },
          now(),
        ),
      );
      const [message] = sent.changes.interactions!;
      expect(message).toMatchObject({
        kind: "message_sent",
        personId: priya.id,
        channel: "email",
        subject: "Hello",
        body: "Hi Priya, a shorter note.",
      });

      // Read back, as a reload would.
      const saved = await loadWorkspace(repository, now());
      expect(saved.drafts.find((d) => d.id === draft.id)).toMatchObject({
        status: "sent",
        sentInteractionId: message?.id,
      });
      expect(saved.interactions.map((i) => i.id)).toEqual([message?.id]);
      expect(saved.people[0]?.relationshipStatus).toBe("contacted");
    });

    it("an unapproved draft can never be marked sent, whoever asks", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const { people } = await onboarded(repository, now());
      const draft = changed(
        await createDraftStep(
          repository,
          { personId: people[0]!.id, channel: "linkedin", body: "Hi Priya" },
          now(),
        ),
      ).changes.drafts![0]!;

      // Through the workflow step: the domain rule refuses.
      expect(
        await markDraftSentStep(repository, { id: draft.id, expected: draft.updatedAt }, now()),
      ).toEqual({ ok: false, problem: "draft_not_approved" });

      // Straight at the repository with a forged "sent" draft: the repository refuses too.
      const at = instant(now().toISOString());
      const interaction = MessageSentSchema.parse({
        id: crypto.randomUUID(),
        userId: repository.userId,
        personId: draft.personId,
        kind: "message_sent",
        channel: "linkedin",
        body: draft.body,
        summary: "Hi Priya",
        occurredAt: at,
        createdAt: at,
        updatedAt: at,
      });
      const forged = markDraftSent(approveDraft(draft, at), interaction.id as InteractionId, at);
      await expect(
        repository.drafts.markSent(
          {
            draft: forged,
            interaction,
            relationshipStatus: { before: "new", after: "contacted" },
          },
          draft.updatedAt,
        ),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === "draft_not_approved",
      );
      const saved = await loadWorkspace(repository, now());
      expect(saved.drafts[0]?.status).toBe("awaiting_approval");
      expect(saved.interactions).toEqual([]);
    });

    it("marking sent twice at once records one message", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const { people } = await onboarded(repository, now());
      const draft = changed(
        await createDraftStep(
          repository,
          { personId: people[0]!.id, channel: "email", subject: "Hi", body: "Hello" },
          now(),
        ),
      ).changes.drafts![0]!;
      const approved = changed(
        await approveDraftStep(repository, { id: draft.id, expected: draft.updatedAt }, now()),
      ).changes.drafts![0]!;
      const both = await Promise.all([
        markDraftSentStep(repository, { id: draft.id, expected: approved.updatedAt }, now()),
        markDraftSentStep(repository, { id: draft.id, expected: approved.updatedAt }, now()),
      ]);
      expect(both.filter((o) => o.ok)).toHaveLength(1);
      expect((await repository.interactions.list()).length).toBe(1);
    });

    it("a stale edit can't overwrite a newer approval", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const { people } = await onboarded(repository, now());
      const draft = changed(
        await createDraftStep(
          repository,
          { personId: people[0]!.id, channel: "email", subject: "Hi", body: "First" },
          now(),
        ),
      ).changes.drafts![0]!;
      changed(
        await approveDraftStep(repository, { id: draft.id, expected: draft.updatedAt }, now()),
      );
      // Another tab still holds the draft as it was before approval.
      expect(
        await reviseDraftStep(
          repository,
          { id: draft.id, body: "Old tab", expected: draft.updatedAt },
          now(),
        ),
      ).toEqual({ ok: false, problem: "conflict" });
      expect(await repository.drafts.get(draft.id)).toMatchObject({
        status: "approved",
        body: "First",
      });
    });

    it("complete and snooze are saved; a finished step can't be finished again", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const { nextActions, user } = await onboarded(repository, now());
      const action = nextActions[0]!;

      const snoozed = changed(
        await snoozeNextActionStep(
          repository,
          { id: action.id, days: 2, expected: action.updatedAt },
          now(),
        ),
      ).changes.nextActions![0]!;
      const today = calendarDateIn(now(), user.timeZone);
      expect(snoozed.dueOn > today).toBe(true);
      expect((await repository.nextActions.get(action.id))?.dueOn).toBe(snoozed.dueOn);

      const done = changed(
        await completeNextActionStep(
          repository,
          { id: action.id, expected: snoozed.updatedAt },
          now(),
        ),
      ).changes.nextActions![0]!;
      expect(done.status).toBe("done");
      expect(await repository.nextActions.get(action.id)).toMatchObject({ status: "done" });
      expect(
        await completeNextActionStep(
          repository,
          { id: action.id, expected: done.updatedAt },
          now(),
        ),
      ).toEqual({ ok: false, problem: "next_action_not_open" });
    });

    it("undo puts back exactly what an action changed, once", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const { people, nextActions } = await onboarded(repository, now());

      const completed = changed(
        await completeNextActionStep(
          repository,
          { id: nextActions[0]!.id, expected: nextActions[0]!.updatedAt },
          now(),
        ),
      );
      changed(await undoStep(repository, { step: completed.undo! }));
      expect(await repository.nextActions.get(nextActions[0]!.id)).toMatchObject({
        status: "open",
        updatedAt: nextActions[0]!.updatedAt,
      });
      expect(await undoStep(repository, { step: completed.undo! })).toEqual({
        ok: false,
        problem: "undo_unavailable",
      });

      const draft = changed(
        await createDraftStep(
          repository,
          { personId: people[0]!.id, channel: "email", subject: "Hi", body: "Hello" },
          now(),
        ),
      ).changes.drafts![0]!;
      const approval = changed(
        await approveDraftStep(repository, { id: draft.id, expected: draft.updatedAt }, now()),
      );
      const approved = approval.changes.drafts![0]!;
      const sent = changed(
        await markDraftSentStep(repository, { id: draft.id, expected: approved.updatedAt }, now()),
      );
      // Marking as sent is final (D-030): no undo step, and the step before it
      // can no longer bring the draft back either.
      expect(sent.undo).toBeUndefined();
      expect(await undoStep(repository, { step: approval.undo! })).toEqual({
        ok: false,
        problem: "conflict",
      });
      const after = await loadWorkspace(repository, now());
      expect(after.drafts.find((d) => d.id === draft.id)?.status).toBe("sent");
      expect(after.interactions.map((i) => i.id)).toEqual([sent.changes.interactions![0]!.id]);
      expect(after.people[0]?.relationshipStatus).toBe("contacted");
    });

    it("undo refuses once the record has changed since", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const { people } = await onboarded(repository, now());
      const created = changed(
        await createDraftStep(
          repository,
          { personId: people[0]!.id, channel: "email", subject: "Hi", body: "Hello" },
          now(),
        ),
      );
      const draft = created.changes.drafts![0]!;
      changed(
        await approveDraftStep(repository, { id: draft.id, expected: draft.updatedAt }, now()),
      );
      // The draft has moved on, so "undo create" would delete a newer state.
      expect(await undoStep(repository, { step: created.undo! })).toEqual({
        ok: false,
        problem: "conflict",
      });
      expect(await repository.drafts.get(draft.id as DraftId)).toMatchObject({
        status: "approved",
      });
    });

    it("settings are saved; the sign-in email isn't changed; a stale save is refused", async () => {
      const repository = await fresh();
      const now = steppingClock();
      await onboarded(repository, now());
      const user = await repository.user.get();

      const saved = await saveProfileStep(
        repository,
        {
          name: "Kofi Asante",
          timeZone: "America/New_York",
          education: {
            institution: "University of Leeds",
            course: "BSc Mathematics",
            graduationYear: 2027,
          },
          expected: user.updatedAt,
        },
        now(),
      );
      if (!saved.ok) throw new Error(saved.problem);
      const reread = await repository.user.get();
      expect(reread).toMatchObject({
        name: "Kofi Asante",
        timeZone: "America/New_York",
        education: {
          institution: "University of Leeds",
          course: "BSc Mathematics",
          graduationYear: 2027,
        },
        email: user.email,
      });

      const goals = await saveGoalsStep(
        repository,
        {
          goals: { ...user.goals!, targetLocations: ["Leeds", "Remote (UK)"] },
          expected: reread.updatedAt,
        },
        now(),
      );
      expect(goals.ok).toBe(true);
      expect((await repository.user.get()).goals?.targetLocations).toEqual([
        "Leeds",
        "Remote (UK)",
      ]);

      // An old copy of the profile can't overwrite the newer one.
      expect(
        await saveProfileStep(
          repository,
          { name: "Old tab", timeZone: "Europe/London", education: null, expected: user.updatedAt },
          now(),
        ),
      ).toEqual({ ok: false, problem: "conflict" });
      expect((await repository.user.get()).name).toBe("Kofi Asante");
    });

    it("reads honour the documented order", async () => {
      const repository = await fresh();
      const now = steppingClock();
      const { people } = await onboarded(repository, now());
      for (const body of ["First", "Second", "Third"]) {
        changed(
          await createDraftStep(
            repository,
            { personId: people[0]!.id, channel: "linkedin", body },
            now(),
          ),
        );
      }
      expect((await repository.drafts.list()).map((d) => d.body)).toEqual([
        "First",
        "Second",
        "Third",
      ]);
      expect((await repository.drafts.list({ status: "approved" })).length).toBe(0);
      expect(
        (await repository.drafts.list({ personId: people[0]!.id })).map((d) => d.body),
      ).toEqual(["First", "Second", "Third"]);
    });
  });
}

/** Asserts a promise rejects with the repository's own error code. */
export async function rejectsWith(promise: Promise<unknown>, code: RepositoryError["code"]) {
  await expect(promise).rejects.toSatisfy(
    (e: unknown) => e instanceof RepositoryError && e.code === code,
  );
}
