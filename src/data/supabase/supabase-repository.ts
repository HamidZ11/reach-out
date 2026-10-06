import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/domain/errors";
import type { DomainErrorCode } from "@/domain/errors";
import type { DraftId, InteractionId, UserId } from "@/domain/ids";
import { compareInstants } from "@/domain/time";
import type {
  GmailConnection,
  GmailRecorded,
  Repository,
  RepositoryErrorCode,
  Reverted,
  UndoStep,
} from "../repository";
import { RepositoryError } from "../repository";
import type { Database, Tables } from "./database.types";
import type { InterpretationRow, OpportunityRow } from "./rows";
import { instantOf } from "./rows";
import {
  companyFromRow,
  companyToRow,
  draftFromRow,
  educationToRow,
  factFromRow,
  goalsToRow,
  interactionFromRow,
  interpretationFromRow,
  nextActionFromRow,
  nextActionToRow,
  opportunityFromRow,
  opportunityPeopleToRows,
  opportunityToRow,
  personFromRow,
  personToRow,
  subjectColumn,
  userFromRow,
} from "./rows";

export type ReachoutClient = SupabaseClient<Database>;

/**
 * The durable Repository: Supabase Postgres, read and written as the signed-in
 * user. Row-level security decides what that user can see; the repository's
 * own workspace filter only keeps queries on their index.
 *
 * Reads go through the Data API. Writes go only through the database's
 * workflow functions (supabase/migrations), which re-check ownership, the
 * caller's version and the transition inside one transaction. The client is
 * created per request by src/server with the user's session; no service key
 * is involved.
 */
export function createSupabaseRepository(
  client: ReachoutClient,
  scope: { userId: UserId; workspaceId: string },
): Repository {
  const { userId, workspaceId } = scope;
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "en-GB");
  const byCreated = (a: { createdAt: string }, b: { createdAt: string }) =>
    Date.parse(a.createdAt) - Date.parse(b.createdAt);

  async function rows<T>(query: PromiseLike<{ data: T[] | null; error: PostgrestError | null }>) {
    const { data, error } = await query;
    if (error) throw repositoryError(error);
    return data ?? [];
  }
  async function row<T>(query: PromiseLike<{ data: T | null; error: PostgrestError | null }>) {
    const { data, error } = await query;
    if (error) throw repositoryError(error);
    return data;
  }
  async function call<T>(query: PromiseLike<{ data: unknown; error: PostgrestError | null }>) {
    const { data, error } = await query;
    if (error) throw repositoryError(error);
    return data as T;
  }
  // Each workspace table, read through RLS and kept on its workspace index.
  const from = {
    companies: () => client.from("companies").select("*").eq("workspace_id", workspaceId),
    people: () => client.from("people").select("*").eq("workspace_id", workspaceId),
    interactions: () => client.from("interactions").select("*").eq("workspace_id", workspaceId),
    drafts: () => client.from("drafts").select("*").eq("workspace_id", workspaceId),
    next_actions: () => client.from("next_actions").select("*").eq("workspace_id", workspaceId),
    source_facts: () => client.from("source_facts").select("*").eq("workspace_id", workspaceId),
  };

  return {
    userId,
    user: {
      async get() {
        const profile = await row(client.from("profiles").select("*").eq("id", userId).single());
        if (!profile) throw new RepositoryError("not_found");
        return userFromRow(profile);
      },
      async save(user, expected) {
        const saved = await call<Tables<"profiles">>(
          client.rpc("save_profile", {
            p_name: user.name,
            p_time_zone: user.timeZone,
            p_education: educationToRow(user.education),
            p_goals: goalsToRow(user.goals),
            p_expected: expected,
            p_at: user.updatedAt,
          }),
        );
        return userFromRow(saved);
      },
    },
    onboarding: {
      async complete(outcome) {
        await call(
          client.rpc("complete_onboarding", {
            p_records: {
              time_zone: outcome.user.timeZone,
              goals: goalsToRow(outcome.user.goals),
              companies: outcome.companies.map(companyToRow),
              people: outcome.people.map(personToRow),
              opportunities: outcome.opportunities.map(opportunityToRow),
              opportunity_people: outcome.opportunities.flatMap(opportunityPeopleToRows),
              next_actions: outcome.nextActions.map(nextActionToRow),
            },
            p_at: outcome.user.onboardingCompletedAt ?? outcome.user.updatedAt,
          }),
        );
      },
    },
    companies: {
      list: async () =>
        (await rows(from.companies())).map((r) => companyFromRow(r, userId)).toSorted(byName),
      get: async (id) => {
        if (!isUuid(id)) return null;
        const found = await row(from.companies().eq("id", id).maybeSingle());
        return found ? companyFromRow(found, userId) : null;
      },
    },
    people: {
      list: async (filter = {}) => {
        let query = from.people();
        if (filter.companyId !== undefined) {
          if (!isUuid(filter.companyId)) return [];
          query = query.eq("company_id", filter.companyId);
        }
        return (await rows(query)).map((r) => personFromRow(r, userId)).toSorted(byName);
      },
      get: async (id) => {
        if (!isUuid(id)) return null;
        const found = await row(from.people().eq("id", id).maybeSingle());
        return found ? personFromRow(found, userId) : null;
      },
    },
    opportunities: {
      list: async (filter = {}) => {
        let query = client
          .from("opportunities")
          .select("*, opportunity_people(person_id, position)")
          .eq("workspace_id", workspaceId);
        if (filter.companyId !== undefined) {
          if (!isUuid(filter.companyId)) return [];
          query = query.eq("company_id", filter.companyId);
        }
        return (await rows<OpportunityRow>(query))
          .map((r) => opportunityFromRow(r, userId))
          .toSorted(byCreated);
      },
      get: async (id) => {
        if (!isUuid(id)) return null;
        const found = await row<OpportunityRow>(
          client
            .from("opportunities")
            .select("*, opportunity_people(person_id, position)")
            .eq("workspace_id", workspaceId)
            .eq("id", id)
            .maybeSingle(),
        );
        return found ? opportunityFromRow(found, userId) : null;
      },
    },
    interactions: {
      list: async (filter = {}) => {
        let query = from.interactions();
        if (filter.personId !== undefined) {
          if (!isUuid(filter.personId)) return [];
          query = query.eq("person_id", filter.personId);
        }
        if (filter.opportunityId !== undefined) {
          if (!isUuid(filter.opportunityId)) return [];
          query = query.eq("opportunity_id", filter.opportunityId);
        }
        return (await rows(query))
          .map((r) => interactionFromRow(r, userId))
          .toSorted((a, b) => compareInstants(a.occurredAt, b.occurredAt));
      },
    },
    drafts: {
      list: async (filter = {}) => {
        let query = from.drafts();
        if (filter.status !== undefined) query = query.eq("status", filter.status);
        if (filter.personId !== undefined) {
          if (!isUuid(filter.personId)) return [];
          query = query.eq("person_id", filter.personId);
        }
        return (await rows(query)).map((r) => draftFromRow(r, userId)).toSorted(byCreated);
      },
      get: async (id) => {
        if (!isUuid(id)) return null;
        const found = await row(from.drafts().eq("id", id).maybeSingle());
        return found ? draftFromRow(found, userId) : null;
      },
      async create(draft) {
        const result = await call<{ draft: Tables<"drafts">; undo: string }>(
          client.rpc("create_draft", {
            p_draft: {
              id: draft.id,
              person_id: draft.personId,
              opportunity_id: draft.opportunityId ?? null,
              channel: draft.channel,
              subject: draft.subject ?? null,
              body: draft.body,
              created_at: draft.createdAt,
            },
          }),
        );
        return { draft: draftFromRow(result.draft, userId), undo: result.undo as UndoStep };
      },
      async approve(draft, expected) {
        const result = await call<{ draft: Tables<"drafts">; undo: string }>(
          client.rpc("approve_draft", {
            p_id: draft.id,
            p_expected: expected,
            p_at: draft.approvedAt,
          }),
        );
        return { draft: draftFromRow(result.draft, userId), undo: result.undo as UndoStep };
      },
      async revise(draft, expected) {
        const result = await call<{ draft: Tables<"drafts">; undo: string }>(
          client.rpc("revise_draft", {
            p_id: draft.id,
            // An email keeps its subject; other channels have none.
            p_subject: draft.subject ?? (null as unknown as string),
            p_body: draft.body,
            p_expected: expected,
            p_at: draft.updatedAt,
          }),
        );
        return { draft: draftFromRow(result.draft, userId), undo: result.undo as UndoStep };
      },
      async markSent({ draft, interaction, relationshipStatus }, expected) {
        const result = await call<{
          draft: Tables<"drafts">;
          interaction: Tables<"interactions">;
          person: Tables<"people">;
        }>(
          client.rpc("mark_draft_sent", {
            p_id: draft.id,
            p_interaction_id: interaction.id,
            p_summary: interaction.summary,
            p_status_before: relationshipStatus.before,
            p_status_after: relationshipStatus.after,
            p_expected: expected,
            p_at: draft.sentAt,
          }),
        );
        return {
          draft: draftFromRow(result.draft, userId),
          interaction: interactionFromRow(result.interaction, userId),
          person: personFromRow(result.person, userId),
        };
      },
    },
    nextActions: {
      list: async (filter = {}) => {
        let query = from.next_actions();
        if (filter.status !== undefined) query = query.eq("status", filter.status);
        if (filter.personId !== undefined) {
          if (!isUuid(filter.personId)) return [];
          query = query.eq("person_id", filter.personId);
        }
        if (filter.opportunityId !== undefined) {
          if (!isUuid(filter.opportunityId)) return [];
          query = query.eq("opportunity_id", filter.opportunityId);
        }
        return (await rows(query))
          .map((r) => nextActionFromRow(r, userId))
          .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn));
      },
      get: async (id) => {
        if (!isUuid(id)) return null;
        const found = await row(from.next_actions().eq("id", id).maybeSingle());
        return found ? nextActionFromRow(found, userId) : null;
      },
      async complete(action, expected) {
        const result = await call<{ next_action: Tables<"next_actions">; undo: string }>(
          client.rpc("complete_next_action", {
            p_id: action.id,
            p_expected: expected,
            p_at: action.completedAt,
          }),
        );
        return {
          nextAction: nextActionFromRow(result.next_action, userId),
          undo: result.undo as UndoStep,
        };
      },
      async reschedule(action, expected) {
        const result = await call<{ next_action: Tables<"next_actions">; undo: string }>(
          client.rpc("reschedule_next_action", {
            p_id: action.id,
            p_due_on: action.dueOn,
            p_expected: expected,
            p_at: action.updatedAt,
          }),
        );
        return {
          nextAction: nextActionFromRow(result.next_action, userId),
          undo: result.undo as UndoStep,
        };
      },
    },
    research: {
      facts: async (subject) => {
        let query = from.source_facts();
        if (subject) {
          if (!isUuid(subject.id)) return [];
          query = query.eq("subject_type", subject.type).eq(subjectColumn(subject), subject.id);
        }
        return (await rows(query)).map((r) => factFromRow(r, userId)).toSorted(byCreated);
      },
      interpretations: async (subject) => {
        let query = client
          .from("interpretations")
          .select("*, interpretation_facts(fact_id, position)")
          .eq("workspace_id", workspaceId);
        if (subject) {
          if (!isUuid(subject.id)) return [];
          query = query.eq("subject_type", subject.type).eq(subjectColumn(subject), subject.id);
        }
        return (await rows<InterpretationRow>(query))
          .map((r) => interpretationFromRow(r, userId))
          .toSorted((a, b) => compareInstants(a.generatedAt, b.generatedAt));
      },
    },
    async undo(step) {
      if (!isUuid(step)) throw new RepositoryError("undo_unavailable");
      const result = await call<{
        restored: { table: string; row: unknown }[];
        removed: { table: string; id: string }[];
      }>(client.rpc("undo_step", { p_step: step }));
      const reverted: Reverted = {
        people: [],
        drafts: [],
        nextActions: [],
        removed: { drafts: [], interactions: [] },
      };
      for (const { table, row: restored } of result.restored) {
        if (table === "people") {
          reverted.people.push(personFromRow(restored as Tables<"people">, userId));
        } else if (table === "drafts") {
          reverted.drafts.push(draftFromRow(restored as Tables<"drafts">, userId));
        } else if (table === "next_actions") {
          reverted.nextActions.push(nextActionFromRow(restored as Tables<"next_actions">, userId));
        }
      }
      for (const { table, id } of result.removed) {
        if (table === "drafts") reverted.removed.drafts.push(id as DraftId);
        if (table === "interactions") reverted.removed.interactions.push(id as InteractionId);
      }
      return reverted;
    },
    gmail: {
      async connection() {
        const found = await row(
          client
            .from("gmail_connections")
            .select("*")
            .eq("workspace_id", workspaceId)
            .maybeSingle(),
        );
        return found ? gmailConnectionFromRow(found) : null;
      },
      async connect(input) {
        const saved = await call<Tables<"gmail_connections">>(
          client.rpc("connect_gmail", {
            p_email: input.emailAddress,
            p_scopes: input.scopes,
            p_sealed_refresh_token: input.credential.sealed,
            p_key_id: input.credential.keyId,
            p_history_cursor: input.historyCursor ?? (null as unknown as string),
            p_at: input.at,
          }),
        );
        return gmailConnectionFromRow(saved);
      },
      async disconnect() {
        const result = await call<{ sealed_refresh_token: string; key_id: string } | null>(
          client.rpc("disconnect_gmail"),
        );
        return result ? { sealed: result.sealed_refresh_token, keyId: result.key_id } : null;
      },
      async beginSync(minIntervalSeconds) {
        const lease = await call<{
          connection: Tables<"gmail_connections">;
          sealed_refresh_token: string;
          key_id: string;
        } | null>(client.rpc("begin_gmail_sync", { p_min_interval_seconds: minIntervalSeconds }));
        if (!lease) return null;
        return {
          connectionId: lease.connection.id,
          emailAddress: lease.connection.email_address,
          credential: { sealed: lease.sealed_refresh_token, keyId: lease.key_id },
          historyCursor: lease.connection.history_cursor ?? undefined,
        };
      },
      async finishSync(connectionId, outcome, historyCursor) {
        await call(
          client.rpc("finish_gmail_sync", {
            p_connection: connectionId,
            p_outcome: outcome,
            p_history_cursor: historyCursor ?? (null as unknown as string),
          }),
        );
      },
      async recorded(providerMessageIds) {
        const found = new Set<string>();
        const ids = providerMessageIds.filter((id) => /^[A-Za-z0-9_-]{1,128}$/.test(id));
        for (let i = 0; i < ids.length; i += 100) {
          const rows = await call<{ provider_message_id: string }[]>(
            client
              .from("gmail_messages")
              .select("provider_message_id")
              .eq("workspace_id", workspaceId)
              .in("provider_message_id", ids.slice(i, i + 100)),
          );
          for (const r of rows) found.add(r.provider_message_id);
        }
        return found;
      },
      async linkedInteractions() {
        const rows = await call<{ interaction_id: string }[]>(
          client.from("gmail_messages").select("interaction_id").eq("workspace_id", workspaceId),
        );
        return new Set(rows.map((r) => r.interaction_id));
      },
      async record(entry): Promise<GmailRecorded> {
        const message = "interaction" in entry ? entry.interaction : undefined;
        const result = await call<{
          outcome: "recorded" | "linked" | "duplicate";
          interaction?: Tables<"interactions">;
          draft?: Tables<"drafts"> | null;
          person?: Tables<"people">;
        }>(
          client.rpc("record_gmail_message", {
            p_message: {
              provider_message_id: entry.providerMessageId,
              thread_id: entry.threadId ?? null,
              person_id: entry.personId,
              direction: message?.kind === "message_received" ? "received" : "sent",
              kind: entry.kind,
              at: entry.at,
              interaction_id: message?.id ?? null,
              occurred_at: message?.occurredAt ?? null,
              summary: message?.summary ?? null,
              subject: message && "subject" in message ? (message.subject ?? null) : null,
              link_interaction_id: entry.kind === "link" ? entry.interactionId : null,
              draft_id: entry.kind === "draft" ? entry.draft.id : null,
              draft_expected: entry.kind === "draft" ? entry.expected : null,
              status_before: entry.kind === "link" ? null : entry.relationshipStatus.before,
              status_after: entry.kind === "link" ? null : entry.relationshipStatus.after,
            },
          }),
        );
        if (result.outcome === "duplicate" || !result.interaction || !result.person) {
          return { outcome: "duplicate" };
        }
        return {
          outcome: result.outcome,
          interaction: interactionFromRow(result.interaction, userId),
          draft: result.draft ? draftFromRow(result.draft, userId) : undefined,
          person: personFromRow(result.person, userId),
        };
      },
    },
  };
}

/** The connection as the screens may see it: never its credentials. */
function gmailConnectionFromRow(row: Tables<"gmail_connections">): GmailConnection {
  return {
    emailAddress: row.email_address,
    status: row.status === "needs_reconnect" ? "needs_reconnect" : "connected",
    connectedAt: instantOf(row.connected_at),
    lastSyncedAt: row.last_synced_at ? instantOf(row.last_synced_at) : undefined,
    lastError: (row.last_error ?? undefined) as GmailConnection["lastError"],
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Durable ids are UUIDs. Anything else (an old or mistyped link) names nothing. */
function isUuid(value: string): boolean {
  return UUID.test(value);
}

const DOMAIN_CODES: readonly DomainErrorCode[] = [
  "draft_not_awaiting_approval",
  "draft_not_approved",
  "draft_not_editable",
  "email_subject_required",
  "next_action_not_open",
  "due_date_in_past",
  "invalid_snooze",
];

const REPOSITORY_CODES: readonly RepositoryErrorCode[] = [
  "not_found",
  "conflict",
  "onboarding_complete",
  "undo_unavailable",
  "invalid",
  "unauthenticated",
];

/**
 * The database's answers, as the domain's and the repository's errors. Raw
 * database messages stay on the server (as the error's cause), never in copy.
 */
export function repositoryError(error: PostgrestError): Error {
  const code = error.message.startsWith("reachout.") ? error.message.slice("reachout.".length) : "";
  if ((DOMAIN_CODES as readonly string[]).includes(code)) {
    return new DomainError(code as DomainErrorCode, error.message);
  }
  if ((REPOSITORY_CODES as readonly string[]).includes(code)) {
    return new RepositoryError(code as RepositoryErrorCode, error.message, { cause: error });
  }
  if (code === "no_workspace") return new RepositoryError("not_found", code, { cause: error });
  switch (error.code) {
    case "PGRST301": // the JWT expired or is invalid
    case "PGRST302":
      return new RepositoryError("unauthenticated", error.message, { cause: error });
    case "PGRST116": // .single() found nothing
    case "42501": // a row-level security check refused the write
    case "23503": // a reference to a record that isn't there (or isn't yours)
    case "22P02": // not an id at all
      return new RepositoryError("not_found", error.message, { cause: error });
    case "23505": // a unique rule, such as one open follow-up per person
      return new RepositoryError("conflict", error.message, { cause: error });
    default:
      return new RepositoryError("unavailable", error.message, { cause: error });
  }
}
