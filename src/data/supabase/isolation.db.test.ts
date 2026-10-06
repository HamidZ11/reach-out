import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, inject, it } from "vitest";
import type { Database } from "@/data/supabase/database.types";
import type { ReachoutClient } from "@/data/supabase/supabase-repository";
import { completeOnboardingStep } from "@/features/onboarding/complete";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import {
  approveDraftStep,
  completeNextActionStep,
  createDraftStep,
  markDraftSentStep,
} from "@/features/workspace/operations";
import type { Workspace } from "@/features/workspace/records";
import { ONBOARDING_ANSWERS, onboarded, steppingClock } from "@/test/repository-contract";
import { anonymousClient, bootstrappedAccount, signedInAccount } from "@/test/supabase-accounts";

/**
 * Two real accounts, A and B, on the local Supabase. Everything here goes
 * through the Data API as a signed-in user (or as nobody), so what holds is
 * enforced by Postgres: row-level security, grants and the workflow
 * functions. The repository's own workspace filter is never involved.
 */

type Account = Awaited<ReturnType<typeof bootstrappedAccount>>;

const TABLES = [
  "profiles",
  "workspaces",
  "workspace_members",
  "companies",
  "people",
  "opportunities",
  "opportunity_people",
  "interactions",
  "drafts",
  "next_actions",
  "source_facts",
  "interpretations",
  "interpretation_facts",
] as const;

const now = steppingClock();
let a: Account;
let b: Account;
let bWorld: Workspace;
let bUndo: string;
let bFactId: string;

/** Everything a client can read from a table, as plain rows. */
async function readAll(client: ReachoutClient, table: (typeof TABLES)[number]) {
  const { data, error } = await client.from(table).select("*");
  if (error) throw error;
  return data as Record<string, unknown>[];
}

const ownerOf = (row: Record<string, unknown>) => (row.workspace_id ?? row.id) as string; // profiles have no workspace: their id is the user

beforeAll(async () => {
  [a, b] = await Promise.all([bootstrappedAccount("a"), bootstrappedAccount("b")]);
  await onboarded(a.repository, now());
  await onboarded(b.repository, now());

  // B has history: a draft approved and marked sent (with its undo step), a
  // second draft waiting, a finished action, and a fact and interpretation.
  const people = await b.repository.people.list();
  const draft = (
    await createDraftStep(
      b.repository,
      { personId: people[0]!.id, channel: "email", subject: "Hi", body: "Hello" },
      now(),
    )
  ).ok;
  expect(draft).toBe(true);
  const [first] = await b.repository.drafts.list();
  const approved = await approveDraftStep(
    b.repository,
    { id: first!.id, expected: first!.updatedAt },
    now(),
  );
  if (!approved.ok) throw new Error(approved.problem);
  const sent = await markDraftSentStep(
    b.repository,
    { id: first!.id, expected: approved.changes.drafts![0]!.updatedAt },
    now(),
  );
  if (!sent.ok || !sent.undo) throw new Error("B's mark sent failed");
  bUndo = sent.undo;
  await createDraftStep(
    b.repository,
    { personId: people[0]!.id, channel: "linkedin", body: "A second note" },
    now(),
  );
  const [action] = await b.repository.nextActions.list();
  await completeNextActionStep(
    b.repository,
    { id: action!.id, expected: action!.updatedAt },
    now(),
  );

  // Facts and interpretations have no write path in Reachout yet (D-022), so
  // the test writes B's with the service key, which only the test holds.
  const { url, serviceRoleKey } = inject("supabase");
  const admin = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const at = now().toISOString();
  bFactId = crypto.randomUUID();
  const interpretationId = crypto.randomUUID();
  const fact = await admin.from("source_facts").insert({
    id: bFactId,
    workspace_id: b.workspaceId,
    subject_type: "person",
    person_id: people[0]!.id,
    statement: "Graduated in Computer Science from the University of Leeds.",
    provenance_kind: "public_profile",
    created_at: at,
    updated_at: at,
  });
  if (fact.error) throw fact.error;
  const interpretation = await admin.from("interpretations").insert({
    id: interpretationId,
    workspace_id: b.workspaceId,
    subject_type: "person",
    person_id: people[0]!.id,
    kind: "outreach_angle",
    text: "Shared degree subject is a natural opening.",
    generated_by_kind: "rule",
    generated_by_name: "test fixture",
    generated_at: at,
    review: "suggested",
    created_at: at,
    updated_at: at,
  });
  if (interpretation.error) throw interpretation.error;
  const cites = await admin.from("interpretation_facts").insert({
    workspace_id: b.workspaceId,
    interpretation_id: interpretationId,
    fact_id: bFactId,
    position: 0,
  });
  if (cites.error) throw cites.error;

  bWorld = await loadWorkspace(b.repository, now(), { research: true });
  expect(bWorld.interactions).toHaveLength(1);
  expect(bWorld.drafts).toHaveLength(2);
  expect(bWorld.facts).toHaveLength(1);
  expect(bWorld.interpretations).toHaveLength(1);
});

describe("two accounts, isolated by the database", () => {
  it("A reads only A's rows, in every table", async () => {
    for (const table of TABLES) {
      const rows = await readAll(a.client, table);
      const owners = new Set(rows.map(ownerOf));
      if (table === "workspace_members") {
        expect(rows.every((r) => r.profile_id === a.userId)).toBe(true);
      }
      expect(
        [...owners].filter((o) => o !== a.workspaceId && o !== a.userId),
        table,
      ).toEqual([]);
    }
  });

  it("B's records can't be read by id, so a guessed link reveals nothing", async () => {
    const ids: [(typeof TABLES)[number], string][] = [
      ["people", bWorld.people[0]!.id],
      ["companies", bWorld.companies[0]!.id],
      ["opportunities", bWorld.opportunities[0]!.id],
      ["drafts", bWorld.drafts[0]!.id],
      ["interactions", bWorld.interactions[0]!.id],
      ["next_actions", bWorld.nextActions[0]!.id],
      ["source_facts", bFactId],
      ["interpretations", bWorld.interpretations[0]!.id],
      ["workspaces", b.workspaceId],
      ["profiles", b.userId],
    ];
    for (const [table, id] of ids) {
      const { data, error } = await a.client
        .from(table)
        .select("*")
        .eq("id" as never, id as never);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
    expect(await a.repository.people.get(bWorld.people[0]!.id)).toBeNull();
    expect(await a.repository.drafts.get(bWorld.drafts[0]!.id)).toBeNull();
    expect(await a.repository.opportunities.get(bWorld.opportunities[0]!.id)).toBeNull();
    expect(await a.repository.companies.get(bWorld.companies[0]!.id)).toBeNull();
  });

  it("A can't change B's records through any workflow function, and gets the same answer as for an id that doesn't exist", async () => {
    const at = now().toISOString();
    const action = bWorld.nextActions[0]!;
    const sentDraft = bWorld.drafts.find((d) => d.status === "sent")!;
    const waiting = bWorld.drafts.find((d) => d.status === "awaiting_approval")!;
    const attempts = [
      a.client.rpc("complete_next_action", {
        p_id: action.id,
        p_expected: action.updatedAt,
        p_at: at,
      }),
      a.client.rpc("reschedule_next_action", {
        p_id: action.id,
        p_due_on: "2030-01-01",
        p_expected: action.updatedAt,
        p_at: at,
      }),
      a.client.rpc("approve_draft", { p_id: waiting.id, p_expected: waiting.updatedAt, p_at: at }),
      a.client.rpc("revise_draft", {
        p_id: waiting.id,
        p_subject: "Taken over",
        p_body: "Taken over",
        p_expected: waiting.updatedAt,
        p_at: at,
      }),
      a.client.rpc("mark_draft_sent", {
        p_id: sentDraft.id,
        p_interaction_id: crypto.randomUUID(),
        p_summary: "x",
        p_status_before: "contacted",
        p_status_after: "contacted",
        p_expected: sentDraft.updatedAt,
        p_at: at,
      }),
      a.client.rpc("create_draft", {
        p_draft: {
          id: crypto.randomUUID(),
          person_id: bWorld.people[0]!.id,
          channel: "email",
          subject: "Hi",
          body: "Planted",
          created_at: at,
        },
      }),
    ];
    for (const attempt of await Promise.all(attempts)) {
      expect(attempt.error?.message).toBe("reachout.not_found");
    }
    const missing = await a.client.rpc("approve_draft", {
      p_id: crypto.randomUUID(),
      p_expected: at,
      p_at: at,
    });
    expect(missing.error?.message).toBe("reachout.not_found");

    const undo = await a.client.rpc("undo_step", { p_step: bUndo });
    expect(undo.error?.message).toBe("reachout.undo_unavailable");

    // A's own profile save touches only A.
    const mine = await a.repository.user.get();
    const saved = await a.client.rpc("save_profile", {
      p_name: "A renamed",
      p_time_zone: "UTC",
      p_education: null,
      p_goals: {
        objective: "internship",
        target_roles: ["Software engineering"],
        target_sectors: ["Fintech"],
        target_locations: ["London"],
      },
      p_expected: mine.updatedAt,
      p_at: at,
    });
    expect(saved.error).toBeNull();

    // B's world is exactly as it was.
    const after = await loadWorkspace(b.repository, now(), { research: true });
    expect(after.drafts).toEqual(bWorld.drafts);
    expect(after.nextActions).toEqual(bWorld.nextActions);
    expect(after.interactions).toEqual(bWorld.interactions);
    expect(after.user).toEqual(bWorld.user);
  });

  it("nobody writes any table directly, not even their own rows", async () => {
    // A column each table has, holding A's own value: the attempt targets A's rows.
    const own = (table: (typeof TABLES)[number]): [string, string] =>
      table === "profiles" || table === "workspaces"
        ? ["id", table === "profiles" ? a.userId : a.workspaceId]
        : table === "workspace_members"
          ? ["profile_id", a.userId]
          : ["workspace_id", a.workspaceId];
    for (const table of TABLES) {
      const [column, value] = own(table);
      const insert = await a.client.from(table).insert({ [column]: value } as never);
      expect(insert.error?.code, `${table} insert`).toBe("42501");
      const update = await a.client
        .from(table)
        .update({ [column]: value } as never)
        .eq(column as never, value as never);
      expect(update.error?.code, `${table} update`).toBe("42501");
      const remove = await a.client
        .from(table)
        .delete()
        .eq(column as never, value as never);
      expect(remove.error?.code, `${table} delete`).toBe("42501");
    }
    // Including joining someone else's workspace.
    const join = await a.client.from("workspace_members").insert({
      workspace_id: b.workspaceId,
      profile_id: a.userId,
      created_at: now().toISOString(),
    });
    expect(join.error?.code).toBe("42501");
    expect((await readAll(b.client, "workspace_members")).map((m) => m.profile_id)).toEqual([
      b.userId,
    ]);
  });

  it("signed out, nothing can be read or called", async () => {
    const anonymous = anonymousClient();
    for (const table of TABLES) {
      const { data, error } = await anonymous.from(table).select("*");
      expect(error?.code ?? (data?.length === 0 ? "empty" : "rows"), table).toBe("42501");
    }
    const call = await anonymous.rpc("bootstrap_account", {
      p_name: "x",
      p_time_zone: "UTC",
      p_at: now().toISOString(),
    });
    expect(call.error?.code).toBe("42501");
  });

  it("B still sees everything that is B's", async () => {
    const people = await readAll(b.client, "people");
    expect(people.map((p) => p.id)).toEqual(bWorld.people.map((p) => p.id));
    expect((await readAll(b.client, "source_facts")).map((f) => f.id)).toEqual([bFactId]);
  });
});

describe("first sign-in and onboarding under racing requests", () => {
  it("first sign-in makes one profile and one workspace however many requests race", async () => {
    const account = await signedInAccount("racer");
    const at = new Date().toISOString();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        account.client.rpc("bootstrap_account", { p_name: "Racer", p_time_zone: "UTC", p_at: at }),
      ),
    );
    const ids = new Set(results.map((r) => r.data));
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(ids.size).toBe(1);
    expect(await readAll(account.client, "workspaces")).toHaveLength(1);
    expect(await readAll(account.client, "workspace_members")).toHaveLength(1);
    expect(await readAll(account.client, "profiles")).toHaveLength(1);
  });

  it("onboarding submitted three times at once is saved once", async () => {
    const account = await bootstrappedAccount("triple");
    const input = { answers: ONBOARDING_ANSWERS, timeZone: "Europe/London" };
    const at = now();
    const results = await Promise.all([
      completeOnboardingStep(account.repository, input, at),
      completeOnboardingStep(account.repository, input, at),
      completeOnboardingStep(account.repository, input, at),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.problem)).toEqual([
      "onboarding_complete",
      "onboarding_complete",
    ]);
    const world = await loadWorkspace(account.repository, now());
    expect(world.people).toHaveLength(1);
    expect(world.companies).toHaveLength(1);
    expect(world.opportunities).toHaveLength(1);
    expect(world.nextActions).toHaveLength(1);
  });
});
