import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { GmailRecord } from "@/data/repository";
import type { Person } from "@/domain/person";
import { MessageReceivedSchema } from "@/domain/interaction";
import { instant } from "@/domain/time";
import { onboarded, steppingClock } from "@/test/repository-contract";
import { anonymousClient, bootstrappedAccount } from "@/test/supabase-accounts";

/**
 * Two accounts, both with Gmail connected, on the local Supabase. Whatever A
 * sends through the Data API, B's connection, credentials and Gmail-recorded
 * history stay B's alone. Google isn't involved: these are the database's
 * guarantees.
 */

type Account = Awaited<ReturnType<typeof bootstrappedAccount>>;

const now = steppingClock();
let a: Account;
let b: Account;
let bPerson: Person;
let aPerson: Person;
const SHARED_MESSAGE_ID = "18c2a1f0b3e4d5f6";

const received = (account: Account, person: Person, providerMessageId: string): GmailRecord => {
  const at = instant(now().toISOString());
  return {
    kind: "new",
    providerMessageId,
    personId: person.id,
    at,
    interaction: MessageReceivedSchema.parse({
      id: crypto.randomUUID(),
      userId: account.userId,
      personId: person.id,
      kind: "message_received",
      channel: "email",
      subject: "Re: hello",
      summary: "Re: hello",
      occurredAt: at,
      createdAt: at,
      updatedAt: at,
    }),
    relationshipStatus: { before: person.relationshipStatus, after: "replied" },
  };
};

beforeAll(async () => {
  [a, b] = await Promise.all([bootstrappedAccount("gmail-a"), bootstrappedAccount("gmail-b")]);
  [aPerson] = (await onboarded(a.repository, now())).people as [Person];
  [bPerson] = (await onboarded(b.repository, now())).people as [Person];
  for (const [account, email] of [
    [a, "a@gmail.example"],
    [b, "b@gmail.example"],
  ] as const) {
    await account.repository.gmail.connect({
      emailAddress: email,
      scopes: ["https://www.googleapis.com/auth/gmail.metadata"],
      credential: { sealed: `v1.sealed-for-${email}`, keyId: "0123456789abcdef" },
      historyCursor: "100",
      at: instant(now().toISOString()),
    });
  }
  const recorded = await b.repository.gmail.record(received(b, bPerson, SHARED_MESSAGE_ID));
  expect(recorded.outcome).toBe("recorded");
});

describe("Gmail across two accounts", () => {
  it("A sees only A's connection and Gmail history; credentials are unreachable", async () => {
    const connections = await a.client.from("gmail_connections").select("*");
    expect(connections.data?.map((c) => c.email_address)).toEqual(["a@gmail.example"]);
    const messages = await a.client.from("gmail_messages").select("*");
    expect(messages.data).toEqual([]);
    // The private schema isn't part of the Data API at all.
    const credentials = await a.client
      .schema("private" as never)
      .from("gmail_credentials")
      .select("*");
    expect(credentials.error).not.toBeNull();
    expect(JSON.stringify(connections.data)).not.toContain("sealed");
  });

  it("A's sync lease is A's: never B's account or credential", async () => {
    const lease = await a.repository.gmail.beginSync(0);
    expect(lease?.emailAddress).toBe("a@gmail.example");
    expect(lease?.credential.sealed).toBe("v1.sealed-for-a@gmail.example");
    await a.repository.gmail.finishSync(lease!.connectionId, "synced", "101");
  });

  it("A can't finish, record into, or disconnect B's Gmail", async () => {
    const bLease = await b.repository.gmail.beginSync(0);
    const finish = await a.client.rpc("finish_gmail_sync", {
      p_connection: bLease!.connectionId,
      p_outcome: "revoked",
      p_history_cursor: "999999",
    });
    expect(finish.error?.message).toBe("reachout.not_found");
    await b.repository.gmail.finishSync(bLease!.connectionId, "synced");
    expect((await b.repository.gmail.connection())?.status).toBe("connected");

    // A message "for" B's person, sent from A's session: refused.
    await expect(
      a.repository.gmail.record(received(a, bPerson, "forged0001")),
    ).rejects.toMatchObject({
      code: "not_found",
    });

    // A disconnecting touches only A.
    await a.repository.gmail.disconnect();
    expect(await b.repository.gmail.connection()).toMatchObject({
      emailAddress: "b@gmail.example",
    });
  });

  it("a provider id B already recorded means nothing in A's workspace", async () => {
    await a.repository.gmail.connect({
      emailAddress: "a@gmail.example",
      scopes: [],
      credential: { sealed: "v1.sealed-again", keyId: "0123456789abcdef" },
      historyCursor: "100",
      at: instant(now().toISOString()),
    });
    expect(await a.repository.gmail.recorded([SHARED_MESSAGE_ID])).toEqual(new Set());
    const mine = await a.repository.gmail.record(received(a, aPerson, SHARED_MESSAGE_ID));
    expect(mine.outcome).toBe("recorded");
    // Recording it again is a no-op, and B's record is untouched.
    expect((await a.repository.gmail.record(received(a, aPerson, SHARED_MESSAGE_ID))).outcome).toBe(
      "duplicate",
    );
    expect(await b.repository.gmail.recorded([SHARED_MESSAGE_ID])).toEqual(
      new Set([SHARED_MESSAGE_ID]),
    );
    expect((await b.repository.interactions.list()).length).toBe(1);
  });

  it("nothing is recorded once Gmail is disconnected", async () => {
    await a.repository.gmail.disconnect();
    await expect(
      a.repository.gmail.record(received(a, aPerson, "after0001")),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("nobody writes the Gmail tables directly", async () => {
    for (const table of ["gmail_connections", "gmail_messages"] as const) {
      const insert = await a.client.from(table).insert({ workspace_id: a.workspaceId } as never);
      expect(insert.error?.code, table).toBe("42501");
      const update = await a.client
        .from(table)
        .update({ workspace_id: a.workspaceId } as never)
        .eq("workspace_id", a.workspaceId);
      expect(update.error?.code, table).toBe("42501");
    }
    const anonymous = anonymousClient();
    expect((await anonymous.from("gmail_connections").select("*")).error?.code).toBe("42501");
    expect(
      (await anonymous.rpc("begin_gmail_sync", { p_min_interval_seconds: 0 })).error?.code,
    ).toBe("42501");
  });
});

describe("rate limits in Postgres", () => {
  const key = () => createHash("sha256").update(crypto.randomUUID()).digest("hex");

  it("allow up to the limit in a window, then refuse; anyone can ask, before signing in", async () => {
    const anonymous = anonymousClient();
    const mine = key();
    const answers: (boolean | null)[] = [];
    for (let i = 0; i < 6; i += 1) {
      const { data, error } = await anonymous.rpc("take_rate_limit", {
        p_bucket: "sign_in_email",
        p_key_hash: mine,
      });
      expect(error).toBeNull();
      answers.push(data);
    }
    expect(answers).toEqual([true, true, true, true, true, false]);
    // Someone else's key is counted separately.
    const other = await anonymous.rpc("take_rate_limit", {
      p_bucket: "sign_in_email",
      p_key_hash: key(),
    });
    expect(other.data).toBe(true);
  });

  it("callers can't invent buckets or store anything but a hash", async () => {
    const anonymous = anonymousClient();
    const bucket = await anonymous.rpc("take_rate_limit", {
      p_bucket: "unlimited",
      p_key_hash: key(),
    });
    expect(bucket.error?.message).toBe("reachout.invalid");
    const raw = await anonymous.rpc("take_rate_limit", {
      p_bucket: "sign_in_email",
      p_key_hash: "student@example.com",
    });
    expect(raw.error?.message).toBe("reachout.invalid");
  });
});
