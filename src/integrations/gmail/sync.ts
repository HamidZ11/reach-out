import "server-only";
import type { GmailRecord, Repository, SealedSecret } from "@/data/repository";
import { RepositoryError } from "@/data/repository";
import type { ObservedEmail } from "@/domain/correspondence";
import { matchCorrespondence, reconcileSent, summaryOf } from "@/domain/correspondence";
import type { Draft } from "@/domain/draft";
import { markDraftSent } from "@/domain/draft";
import { DomainError } from "@/domain/errors";
import type { PersonId } from "@/domain/ids";
import type { Interaction, MessageSent } from "@/domain/interaction";
import { MessageReceivedSchema, MessageSentSchema } from "@/domain/interaction";
import type { Person } from "@/domain/person";
import { relationshipStatusAfter } from "@/domain/person";
import type { Instant } from "@/domain/time";
import { instant } from "@/domain/time";
import type { GmailApi, GmailMessageRef } from "./api";
import { GmailError } from "./http";
import { isIgnored, observedEmail } from "./messages";

/**
 * One Gmail sync (D-031): read what the mailbox gained since the stored
 * history cursor, keep only mail with people the user tracks (exact
 * addresses), and add it to their history through `repository.gmail.record`,
 * which records each message once.
 *
 * - Bounded: one sync at a time per account (a database lease), a time
 *   budget, and the cursor saved as each change is finished, so the next sync
 *   continues where this one stopped.
 * - Safe to fail: nothing half-applies (each message is its own transaction),
 *   and a failure leaves Reachout's records exactly as they were.
 * - A revoked or narrowed grant stops syncing until the user reconnects.
 */

export type GmailSyncDeps = {
  repository: Repository;
  /** The stored refresh token, opened. Throws if it can't be (for example, a lost key). */
  openCredential(credential: SealedSecret): string;
  /** A short-lived access token for the refresh token. */
  accessToken(refreshToken: string): Promise<string>;
  api(accessToken: string): GmailApi;
  now(): Date;
  newId?: () => string;
  /** No new work starts after this long. */
  budgetMs?: number;
};

export type GmailSyncResult =
  | { status: "skipped" }
  | { status: "synced" | "history_reset" | "unavailable"; recorded: number }
  | { status: "needs_reconnect" };

/** Header fetches in flight at once. */
const PARALLEL = 4;

export async function syncGmail(
  deps: GmailSyncDeps,
  { minIntervalSeconds }: { minIntervalSeconds: number },
): Promise<GmailSyncResult> {
  const { repository } = deps;
  const lease = await repository.gmail.beginSync(minIntervalSeconds);
  if (!lease) return { status: "skipped" };

  const deadline = Date.now() + (deps.budgetMs ?? 20_000);
  const newId = deps.newId ?? (() => crypto.randomUUID());
  let cursor = lease.historyCursor;
  let recorded = 0;
  let api: GmailApi | undefined;

  try {
    let refreshToken: string;
    try {
      refreshToken = deps.openCredential(lease.credential);
    } catch {
      throw new GmailError("revoked", "The stored credential can't be opened");
    }
    api = deps.api(await deps.accessToken(refreshToken));

    // Connected without a starting point: start from now.
    if (!cursor) {
      cursor = (await api.profile()).historyId;
      await repository.gmail.finishSync(lease.connectionId, "synced", cursor);
      return { status: "synced", recorded };
    }

    const held = await holdings(repository);
    const startedFrom = cursor;
    let pageToken: string | undefined;
    for (let page = 0; page < 10 && Date.now() < deadline; page += 1) {
      const history = await api.history(startedFrom, pageToken);
      let read = 0;
      for (const change of history.records) {
        if (Date.now() >= deadline) break;
        recorded += await takeIn(change.added);
        cursor = change.id;
        read += 1;
      }
      const wholePage = read === history.records.length;
      pageToken = history.nextPageToken;
      // Every change read and nothing more to come: continue from the mailbox's position now.
      if (wholePage && !pageToken) cursor = history.historyId;
      if (!wholePage || !pageToken) break;
    }
    await repository.gmail.finishSync(lease.connectionId, "synced", cursor);
    return { status: "synced", recorded };

    /** The messages one change added: new ones, read and recorded in the order they were sent. */
    async function takeIn(refs: readonly GmailMessageRef[]): Promise<number> {
      if (!held.people.some((p) => p.email)) return 0;
      const fresh = refs.filter((ref) => !isIgnored(ref.labelIds));
      if (fresh.length === 0) return 0;
      const known = await repository.gmail.recorded(fresh.map((r) => r.id));
      const unread = fresh.filter((r) => !known.has(r.id));
      const emails: ObservedEmail[] = [];
      for (let i = 0; i < unread.length; i += PARALLEL) {
        const batch = await Promise.all(
          unread.slice(i, i + PARALLEL).map((r) => api!.message(r.id)),
        );
        for (const message of batch) {
          const email = message ? observedEmail(message) : null;
          if (email) emails.push(email);
        }
      }
      let count = 0;
      for (const email of emails.toSorted((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt))) {
        for (const match of matchCorrespondence(email, held.people)) {
          count += (await recordOnce(email, match.personId, match.direction)) ? 1 : 0;
        }
      }
      return count;
    }

    /** Records one message for one person; on a race with the user, looks again once. */
    async function recordOnce(
      email: ObservedEmail,
      personId: PersonId,
      direction: "sent" | "received",
    ): Promise<boolean> {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const entry = entryFor(email, personId, direction);
        if (!entry) return false;
        try {
          const result = await repository.gmail.record(entry);
          if (result.outcome === "duplicate") return false;
          held.people = held.people.map((p) => (p.id === result.person.id ? result.person : p));
          held.interactions = upsert(held.interactions, result.interaction);
          if (result.draft) held.drafts = upsert(held.drafts, result.draft);
          held.linked.add(result.interaction.id);
          return true;
        } catch (error) {
          const raced =
            (error instanceof RepositoryError && error.code === "conflict") ||
            (error instanceof DomainError && error.code === "draft_not_approved");
          if (!raced || attempt > 0) throw error;
          Object.assign(held, await holdings(repository));
        }
      }
      return false;
    }

    function entryFor(
      email: ObservedEmail,
      personId: PersonId,
      direction: "sent" | "received",
    ): GmailRecord | null {
      const person = held.people.find((p) => p.id === personId);
      if (!person) return null;
      const at = instant(deps.now().toISOString());
      const base = {
        providerMessageId: email.providerMessageId,
        threadId: email.threadId,
        personId,
        at,
      };
      const message = (kind: "message_sent" | "message_received", draft?: Draft) =>
        (kind === "message_sent" ? MessageSentSchema : MessageReceivedSchema).parse({
          id: newId(),
          userId: repository.userId,
          personId,
          opportunityId: draft?.opportunityId,
          kind,
          channel: "email",
          subject: email.subject,
          summary: summaryOf(email),
          occurredAt: email.sentAt,
          createdAt: at,
          updatedAt: at,
        });
      const status = (kind: "message_sent" | "message_received") => ({
        before: person.relationshipStatus,
        after: relationshipStatusAfter(person.relationshipStatus, kind),
      });

      if (direction === "received") {
        return {
          ...base,
          kind: "new",
          interaction: message("message_received"),
          relationshipStatus: status("message_received"),
        };
      }
      const decision = reconcileSent(email, personId, held);
      if (decision.kind === "link")
        return { ...base, kind: "link", interactionId: decision.interactionId };
      if (decision.kind === "draft") {
        const draft = held.drafts.find((d) => d.id === decision.draftId);
        if (draft) {
          const sent = message("message_sent", draft) as MessageSent;
          return {
            ...base,
            kind: "draft",
            interaction: sent,
            draft: { ...markDraftSent(draft, sent.id, email.sentAt), updatedAt: at as Instant },
            expected: draft.updatedAt,
            relationshipStatus: status("message_sent"),
          };
        }
      }
      return {
        ...base,
        kind: "new",
        interaction: message("message_sent"),
        relationshipStatus: status("message_sent"),
      };
    }
  } catch (error) {
    const kind = error instanceof GmailError ? error.kind : "unavailable";
    if (kind === "history_expired" && api) {
      // Too long since the last sync for Gmail to replay: continue from now.
      try {
        const now = await api.profile();
        await repository.gmail.finishSync(lease.connectionId, "history_reset", now.historyId);
        return { status: "history_reset", recorded };
      } catch {
        // Falls through to "unavailable".
      }
    }
    if (kind === "revoked" || kind === "permission") {
      await repository.gmail.finishSync(lease.connectionId, kind).catch(() => undefined);
      return { status: "needs_reconnect" };
    }
    if (!(error instanceof GmailError)) console.error("Gmail sync failed", errorName(error));
    await repository.gmail
      .finishSync(lease.connectionId, "unavailable", cursor)
      .catch(() => undefined);
    return { status: "unavailable", recorded };
  }
}

/** What reconciliation reads: the people, drafts and messages Reachout holds now. */
async function holdings(repository: Repository) {
  const [people, drafts, interactions, linked] = await Promise.all([
    repository.people.list(),
    repository.drafts.list(),
    repository.interactions.list(),
    repository.gmail.linkedInteractions(),
  ]);
  return {
    people: people as Person[],
    drafts: drafts as Draft[],
    interactions: interactions as Interaction[],
    linked,
  };
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];
}

/** Errors are logged by name only: provider responses and tokens never reach the logs. */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
