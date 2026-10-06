import { useMemo, useRef, useState } from "react";
import type { Draft } from "@/domain/draft";
import type { DraftId, NextActionId, PersonId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import type { NextAction } from "@/domain/next-action";
import { snoozeNextAction } from "@/domain/next-action";
import { deriveOutreachState } from "@/domain/outreach";
import type { Person } from "@/domain/person";
import type { Instant } from "@/domain/time";
import { compareInstants } from "@/domain/time";
import { deriveToday } from "@/domain/today";
import { dayOf } from "@/components/dates";
import type { Changes, DraftInput, Outcome, Problem, WorkspaceActions } from "./outcome";
import { problemMessage } from "./outcome";
import type { Workspace } from "./records";
import { indexRecords } from "./records";

/** How a change went, for the announcer. `ignored`: another change was still saving. */
export type ActResult =
  /** `undoable`: Undo can put it back. Some changes are final (D-030). */
  | { ok: true; undoable: boolean }
  | { ok: false; ignored: true }
  | { ok: false; ignored?: false; problem: Problem; message: string };

/**
 * The user's workspace on screen. Actions run the real workflow steps through
 * `actions` (Server Actions in production, which persist through the
 * Repository) and the screen changes only once the answer arrives: what it
 * shows is what was saved, and a failure says so. Today is re-derived with
 * `deriveToday` from the saved records.
 *
 * Undo puts back exactly what the last action changed, through the same
 * actions, as long as nothing has changed it since. Marking a message sent is
 * final and offers no Undo (D-030).
 */
export function useWorkspace(snapshot: Workspace, actions: WorkspaceActions) {
  const { now, today, user } = snapshot;
  const [people, setPeople] = useState<Person[]>(snapshot.people);
  const [nextActions, setNextActions] = useState<NextAction[]>(snapshot.nextActions);
  const [drafts, setDrafts] = useState<Draft[]>(snapshot.drafts);
  const [interactions, setInteractions] = useState<Interaction[]>(snapshot.interactions);
  // A fresh read from the server (after a change, or a Gmail check) is the
  // truth: take it in place of what's on screen.
  const [adopted, setAdopted] = useState(snapshot);
  if (adopted !== snapshot) {
    setAdopted(snapshot);
    setPeople(snapshot.people);
    setNextActions(snapshot.nextActions);
    setDrafts(snapshot.drafts);
    setInteractions(snapshot.interactions);
  }
  // Undo steps for this page's actions, newest last.
  const [steps, setSteps] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const records = useMemo(
    () => ({
      companies: snapshot.companies,
      opportunities: snapshot.opportunities,
      facts: snapshot.facts,
      interpretations: snapshot.interpretations,
      people,
      nextActions,
      drafts,
      interactions,
    }),
    [snapshot, people, nextActions, drafts, interactions],
  );
  const index = useMemo(
    () => indexRecords(records, today, user.timeZone),
    [records, today, user.timeZone],
  );
  const items = useMemo(() => deriveToday({ today, ...records }), [records, today]);
  const contexts = useMemo(() => items.map((item) => index.context(item)), [items, index]);

  const outreachOf = (personId: PersonId) => {
    const person = index.person(personId);
    return person ? deriveOutreachState({ person, today, ...records }) : "not_started";
  };

  /** Things the user finished today, newest first. */
  const finished = useMemo(() => {
    const isToday = (at: Instant) => dayOf(at, user.timeZone) === today;
    return [
      ...nextActions.flatMap((a) =>
        a.status === "done" && isToday(a.completedAt)
          ? [{ label: a.title, at: a.completedAt }]
          : [],
      ),
      ...drafts.flatMap((d) => {
        if (d.status !== "sent" || !isToday(d.sentAt)) return [];
        const name = index.person(d.personId)?.name ?? "someone";
        return [
          { label: `Sent ${d.channel === "email" ? "email" : "message"} to ${name}`, at: d.sentAt },
        ];
      }),
    ].toSorted((a, b) => compareInstants(b.at, a.at));
  }, [nextActions, drafts, index, today, user.timeZone]);

  /** Saved records replace what's on screen; removed ones go. */
  const apply = (changes: Changes) => {
    setPeople((all) => merge(all, changes.people));
    setNextActions((all) => merge(all, changes.nextActions));
    setDrafts((all) =>
      merge(all, changes.drafts).filter((d) => !changes.removed?.drafts?.includes(d.id)),
    );
    setInteractions((all) =>
      merge(all, changes.interactions).filter(
        (i) => !changes.removed?.interactions?.includes(i.id),
      ),
    );
  };

  /** One change at a time: a second click while saving does nothing. */
  async function perform(call: () => Promise<Outcome>): Promise<ActResult> {
    if (busy.current) return { ok: false, ignored: true };
    busy.current = true;
    setPending(true);
    try {
      const outcome = await call();
      if (!outcome.ok) {
        return { ok: false, problem: outcome.problem, message: problemMessage(outcome.problem) };
      }
      apply(outcome.changes);
      const undo = outcome.undo;
      // Undo always means the last action: a final change (like marking a
      // message sent) ends what came before it, too.
      setSteps((s) => (undo ? [...s, undo].slice(-20) : []));
      return { ok: true, undoable: Boolean(undo) };
    } catch (error) {
      console.error("A workspace change could not be sent", error);
      return { ok: false, problem: "unavailable", message: problemMessage("unavailable") };
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const actionById = (id: NextActionId) => nextActions.find((a) => a.id === id);
  const draftById = (id: DraftId) => drafts.find((d) => d.id === id);
  const missing: ActResult = {
    ok: false,
    problem: "not_found",
    message: problemMessage("not_found"),
  };

  return {
    today,
    now,
    user,
    records,
    index,
    items,
    contexts,
    finished,
    outreachOf,
    /** A change is being saved. */
    pending,
    canUndo: steps.length > 0,
    /** Puts back what the last action changed. */
    async undo(): Promise<ActResult> {
      const step = steps.at(-1);
      if (!step) return { ok: false, ignored: true };
      const result = await perform(() => actions.undo({ step }));
      // Spent, or no longer possible: either way this step is done with.
      if (result.ok || (!result.ignored && result.problem !== "unavailable")) {
        setSteps((s) => s.filter((x) => x !== step));
      }
      return result;
    },
    complete(id: NextActionId) {
      const action = actionById(id);
      if (!action) return Promise.resolve(missing);
      return perform(() => actions.completeNextAction({ id, expected: action.updatedAt }));
    },
    snooze(id: NextActionId, days = 1) {
      const action = actionById(id);
      if (!action) return Promise.resolve(missing);
      return perform(() => actions.snoozeNextAction({ id, days, expected: action.updatedAt }));
    },
    /** The date a snooze would move an action to, from the domain rule itself. */
    snoozeTarget: (action: NextAction, days = 1) =>
      snoozeNextAction(action, days, today, now).dueOn,
    approve(id: DraftId) {
      const draft = draftById(id);
      if (!draft) return Promise.resolve(missing);
      return perform(() => actions.approveDraft({ id, expected: draft.updatedAt }));
    },
    revise(id: DraftId, body: string) {
      const draft = draftById(id);
      if (!draft) return Promise.resolve(missing);
      return perform(() => actions.reviseDraft({ id, body, expected: draft.updatedAt }));
    },
    /** Records what the user sent themselves. Nothing is sent from Reachout. */
    markSent(id: DraftId) {
      const draft = draftById(id);
      if (!draft) return Promise.resolve(missing);
      return perform(() => actions.markDraftSent({ id, expected: draft.updatedAt }));
    },
    saveDraft(input: DraftInput) {
      return perform(() =>
        actions.createDraft({ ...input, subject: input.subject?.trim() || undefined }),
      );
    },
  };
}

function merge<T extends { id: string }>(all: T[], changed: T[] | undefined): T[] {
  if (!changed?.length) return all;
  const byId = new Map(changed.map((record) => [record.id, record]));
  const known = new Set(all.map((record) => record.id));
  return [
    ...all.map((record) => byId.get(record.id) ?? record),
    ...changed.filter((r) => !known.has(r.id)),
  ];
}

export type WorkspaceState = ReturnType<typeof useWorkspace>;
