import { useMemo, useRef, useState } from "react";
import type { Draft } from "@/domain/draft";
import { approveDraft, DraftSchema, markDraftSent, reviseDraft } from "@/domain/draft";
import type { DraftId, NextActionId, OpportunityId, PersonId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import { MessageSentSchema } from "@/domain/interaction";
import type { NextAction } from "@/domain/next-action";
import { completeNextAction, snoozeNextAction } from "@/domain/next-action";
import { deriveOutreachState } from "@/domain/outreach";
import type { Person } from "@/domain/person";
import { relationshipStatusAfter } from "@/domain/person";
import type { Instant } from "@/domain/time";
import { compareInstants } from "@/domain/time";
import { deriveToday } from "@/domain/today";
import { dayOf } from "./dates";
import type { Snapshot } from "./snapshot";
import { indexRecords } from "./snapshot";

/**
 * Prototype session state. Actions run the real domain functions against a
 * local copy of the records, and Today is re-derived with `deriveToday`.
 * Nothing is saved: a reload restores the seed data.
 */
export function useDay(snapshot: Snapshot) {
  const { now, today, user } = snapshot;
  const [people, setPeople] = useState<Person[]>(snapshot.people);
  const [nextActions, setNextActions] = useState<NextAction[]>(snapshot.nextActions);
  const [drafts, setDrafts] = useState<Draft[]>(snapshot.drafts);
  const [interactions, setInteractions] = useState<Interaction[]>(snapshot.interactions);
  const created = useRef(0);
  // Undo history for this prototype session: the record sets before each action.
  const [past, setPast] = useState<
    { people: Person[]; nextActions: NextAction[]; drafts: Draft[]; interactions: Interaction[] }[]
  >([]);
  const remember = () =>
    setPast((p) => [...p, { people, nextActions, drafts, interactions }].slice(-20));

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

  const updateAction = (id: NextActionId, change: (a: NextAction) => NextAction) => {
    remember();
    setNextActions((all) => all.map((a) => (a.id === id ? change(a) : a)));
  };
  const updateDraft = (id: DraftId, change: (d: Draft) => Draft) => {
    remember();
    setDrafts((all) => all.map((d) => (d.id === id ? change(d) : d)));
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
    canUndo: past.length > 0,
    /** Restores the records as they were before the last action. */
    undo() {
      const last = past.at(-1);
      if (!last) return;
      setPeople(last.people);
      setNextActions(last.nextActions);
      setDrafts(last.drafts);
      setInteractions(last.interactions);
      setPast((p) => p.slice(0, -1));
    },
    complete: (id: NextActionId) => updateAction(id, (a) => completeNextAction(a, now)),
    snooze: (id: NextActionId, days = 1) =>
      updateAction(id, (a) => snoozeNextAction(a, days, today, now)),
    /** The date a snooze would move an action to, from the domain rule itself. */
    snoozeTarget: (action: NextAction, days = 1) =>
      snoozeNextAction(action, days, today, now).dueOn,
    approve: (id: DraftId) => updateDraft(id, (d) => approveDraft(d, now)),
    revise: (id: DraftId, body: string) => updateDraft(id, (d) => reviseDraft(d, { body }, now)),
    markSent(id: DraftId) {
      const draft = drafts.find((d) => d.id === id);
      if (!draft) return;
      const sent = MessageSentSchema.parse({
        id: `local_sent_${draft.id}`,
        userId: draft.userId,
        personId: draft.personId,
        opportunityId: draft.opportunityId,
        kind: "message_sent",
        channel: draft.channel,
        subject: draft.subject,
        body: draft.body,
        occurredAt: now,
        summary: draft.subject ?? draft.body.split("\n")[0] ?? draft.body,
        createdAt: now,
        updatedAt: now,
      });
      updateDraft(id, (d) => markDraftSent(d, sent.id, now));
      setInteractions((all) => [...all, sent]);
      setPeople((all) =>
        all.map((p) =>
          p.id === draft.personId
            ? {
                ...p,
                relationshipStatus: relationshipStatusAfter(p.relationshipStatus, "message_sent"),
              }
            : p,
        ),
      );
    },
    saveDraft(input: {
      personId: PersonId;
      opportunityId?: OpportunityId;
      channel: Draft["channel"];
      subject?: string;
      body: string;
    }) {
      created.current += 1;
      remember();
      const draft = DraftSchema.parse({
        id: `local_draft_${created.current}`,
        userId: user.id,
        ...input,
        subject: input.subject?.trim() || undefined,
        origin: "user",
        status: "awaiting_approval",
        createdAt: now,
        updatedAt: now,
      });
      setDrafts((all) => [...all, draft]);
    },
  };
}

export type Day = ReturnType<typeof useDay>;
