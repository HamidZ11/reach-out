import { beforeEach, describe, expect, it } from "vitest";
import type { Repository } from "@/data/repository";
import { deriveToday } from "@/domain/today";
import { approveDraftStep, markDraftSentStep } from "@/features/workspace/operations";
import { createDraftStep } from "@/features/workspace/operations";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { CompanySchema } from "@/domain/company";
import type { Person } from "@/domain/person";
import { PersonSchema } from "@/domain/person";
import type { GmailApi, GmailMessage } from "@/integrations/gmail/api";
import { GmailError } from "@/integrations/gmail/http";
import type { GmailSyncDeps } from "@/integrations/gmail/sync";
import { syncGmail } from "@/integrations/gmail/sync";

/**
 * Gmail sync against any Repository, with a fake mailbox in place of Google:
 * what Gmail shows becomes history only for tracked people, once, and a
 * failure changes nothing. Runs on the in-memory repository in `pnpm test`
 * and on the local Supabase in `pnpm test:db`.
 */

const OWNER = "kofi@gmail.example";
const SEALED = { sealed: "v1.test", keyId: "0123456789abcdef" };

/** The tracked people, with ids made when the account is set up. */
let priya: Person;
let priyaNair: Person;
type Mail = {
  id: string;
  sent: boolean;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  at: string;
};

/** A mailbox that only answers what Reachout may ask: profile, history, headers. */
function fakeMailbox() {
  const messages = new Map<string, GmailMessage>();
  const history: { id: string; added: { id: string; threadId: string; labelIds: string[] }[] }[] =
    [];
  let position = 100;
  const state = { revoked: false, down: false, expired: false };
  return {
    state,
    get position() {
      return String(position);
    },
    deliver(mail: Mail) {
      const labelIds = mail.sent ? ["SENT"] : ["INBOX", "UNREAD"];
      messages.set(mail.id, {
        id: mail.id,
        threadId: mail.id,
        labelIds,
        internalDate: String(Date.parse(mail.at)),
        payload: {
          headers: [
            { name: "From", value: mail.from },
            { name: "To", value: mail.to },
            ...(mail.cc ? [{ name: "Cc", value: mail.cc }] : []),
            { name: "Subject", value: mail.subject },
          ],
        },
      });
      position += 1;
      history.push({ id: String(position), added: [{ id: mail.id, threadId: mail.id, labelIds }] });
    },
    /** Gmail can mention a message again in a later change. */
    mentionAgain(id: string) {
      position += 1;
      const known = messages.get(id)!;
      history.push({
        id: String(position),
        added: [{ id, threadId: id, labelIds: known.labelIds! }],
      });
    },
    api(): GmailApi {
      const fail = () => {
        if (state.revoked) throw new GmailError("revoked");
        if (state.down) throw new GmailError("unavailable");
      };
      return {
        async profile() {
          fail();
          return { emailAddress: OWNER, historyId: String(position) };
        },
        async history(start) {
          fail();
          if (state.expired) throw new GmailError("history_expired");
          return {
            records: history.filter((h) => Number(h.id) > Number(start)),
            historyId: String(position),
          };
        },
        async message(id) {
          fail();
          return messages.get(id) ?? null;
        },
      };
    },
  };
}

let repository: Repository;
let mailbox: ReturnType<typeof fakeMailbox>;
let clock: number;

function deps(): GmailSyncDeps {
  return {
    repository,
    openCredential: (credential) => {
      if (credential.sealed !== SEALED.sealed) throw new Error("not ours");
      return "refresh-token";
    },
    accessToken: async () => {
      if (mailbox.state.revoked) throw new GmailError("revoked");
      return "access-token";
    },
    api: () => mailbox.api(),
    now: () => new Date((clock += 1000)),
  };
}
const sync = () => syncGmail(deps(), { minIntervalSeconds: 0 });

/** A new account with Priya Natarajan, Priya Nair, and Tom (who has no address). */
async function setUp(fresh: () => Promise<Repository>) {
  clock = Date.parse("2026-10-06T12:00:00Z");
  repository = await fresh();
  const at = "2026-10-06T10:00:00.000Z";
  const owned = { userId: repository.userId, createdAt: at, updatedAt: at };
  const halden = CompanySchema.parse({
    id: crypto.randomUUID(),
    name: "Halden Robotics",
    ...owned,
  });
  const person = (name: string, extra: Record<string, string>) =>
    PersonSchema.parse({
      id: crypto.randomUUID(),
      name,
      source: { kind: "alumni_network" },
      relationshipStatus: "new",
      ...owned,
      ...extra,
    });
  const people = [
    person("Priya Natarajan", { companyId: halden.id, email: "priya@halden.example" }),
    person("Priya Nair", { role: "Researcher", email: "priya.nair@orbis.example" }),
    person("Tom Achebe", { role: "Founder" }),
  ];
  [priya, priyaNair] = people as [Person, Person, Person];
  const user = await repository.user.get();
  await repository.onboarding.complete({
    user: {
      ...user,
      timeZone: "Europe/London",
      goals: {
        objective: "internship",
        targetRoles: ["Software engineering"],
        targetSectors: ["Robotics"],
        targetLocations: ["London"],
      },
      onboardingCompletedAt: at as never,
      updatedAt: at as never,
    },
    companies: [halden],
    people,
    opportunities: [],
    nextActions: [],
  });
  mailbox = fakeMailbox();
  await repository.gmail.connect({
    emailAddress: OWNER,
    scopes: ["https://www.googleapis.com/auth/gmail.metadata"],
    credential: SEALED,
    historyCursor: mailbox.position,
    at: "2026-10-06T11:00:00.000Z" as never,
  });
}

const sentToPriya = (overrides: Partial<Mail> = {}): Mail => ({
  id: "m1sent",
  sent: true,
  from: `Kofi <${OWNER}>`,
  to: '"Priya" <priya@halden.example>',
  subject: "Your summer internship",
  at: "2026-10-06T11:30:00Z",
  ...overrides,
});

export function gmailSyncContract(name: string, fresh: () => Promise<Repository>) {
  describe(`${name}: Gmail sync`, () => {
    beforeEach(async () => {
      await setUp(fresh);
    });

    it("a message you sent to a tracked person joins their history, once", async () => {
      mailbox.deliver(sentToPriya());
      expect(await sync()).toEqual({ status: "synced", recorded: 1 });
      mailbox.mentionAgain("m1sent");
      expect(await sync()).toEqual({ status: "synced", recorded: 0 });

      const [message, ...rest] = await repository.interactions.list();
      expect(rest).toEqual([]);
      expect(message).toMatchObject({
        kind: "message_sent",
        personId: priya.id,
        channel: "email",
        subject: "Your summer internship",
        summary: "Your summer internship",
        occurredAt: "2026-10-06T11:30:00.000Z",
      });
      expect((await repository.people.get(priya.id))?.relationshipStatus).toBe("contacted");
    });

    it("a reply from a tracked person is history, and Today asks you to answer it", async () => {
      mailbox.deliver({
        id: "m2reply",
        sent: false,
        from: "Priya Natarajan <priya@halden.example>",
        to: OWNER,
        subject: "Re: Your summer internship",
        at: "2026-10-06T11:45:00Z",
      });
      expect(await sync()).toEqual({ status: "synced", recorded: 1 });
      const workspace = await loadWorkspace(repository, new Date("2026-10-06T12:30:00Z"));
      expect(workspace.interactions).toHaveLength(1);
      expect(workspace.interactions[0]).toMatchObject({
        kind: "message_received",
        personId: priya.id,
      });
      expect(workspace.people.find((p) => p.id === priya.id)?.relationshipStatus).toBe("replied");
      expect(deriveToday(workspace).map((item) => item.kind)).toEqual(["reply_awaiting_response"]);
    });

    it("ignores everyone it doesn't know, and never guesses", async () => {
      mailbox.deliver({
        id: "m3",
        sent: false,
        from: "news@ledger.example",
        to: OWNER,
        subject: "Weekly",
        at: "2026-10-06T11:10:00Z",
      });
      // Someone else writing with Priya in copy is not Priya replying.
      mailbox.deliver({
        id: "m4",
        sent: false,
        from: "hr@halden.example",
        to: OWNER,
        cc: "priya@halden.example",
        subject: "Interview",
        at: "2026-10-06T11:11:00Z",
      });
      // Tom has no address, so nothing can be his; a similar name is not a match.
      mailbox.deliver({
        id: "m5",
        sent: true,
        from: OWNER,
        to: "Tom Achebe <tom@quill.example>",
        subject: "Hi Tom",
        at: "2026-10-06T11:12:00Z",
      });
      mailbox.deliver({
        id: "m6",
        sent: true,
        from: OWNER,
        to: "Priya Natarajan <p.natarajan@elsewhere.example>",
        subject: "Hi",
        at: "2026-10-06T11:13:00Z",
      });
      expect(await sync()).toEqual({ status: "synced", recorded: 0 });
      expect(await repository.interactions.list()).toEqual([]);
    });

    it("two Priyas never cross: each address is its own person", async () => {
      mailbox.deliver(
        sentToPriya({ id: "m7", to: "priya.nair@orbis.example", subject: "Your paper" }),
      );
      await sync();
      expect((await repository.interactions.list()).map((i) => i.personId)).toEqual([priyaNair.id]);
    });

    it("the one approved draft with that subject is marked sent by the message that sent it", async () => {
      const at = new Date("2026-10-06T11:00:00Z");
      const created = await createDraftStep(
        repository,
        {
          personId: priya.id,
          channel: "email",
          subject: "Your  summer internship",
          body: "Hi Priya",
        },
        at,
      );
      const draft = created.ok ? created.changes.drafts![0]! : null;
      const approved = await approveDraftStep(
        repository,
        { id: draft!.id, expected: draft!.updatedAt },
        at,
      );
      expect(approved.ok).toBe(true);

      mailbox.deliver(sentToPriya());
      await sync();
      const [message] = await repository.interactions.list();
      expect(await repository.drafts.get(draft!.id)).toMatchObject({
        status: "sent",
        sentInteractionId: message!.id,
        sentAt: "2026-10-06T11:30:00.000Z",
      });
    });

    it("when it isn't certain which draft, no draft changes", async () => {
      const at = new Date("2026-10-06T11:00:00Z");
      for (const body of ["First version", "Second version"]) {
        const created = await createDraftStep(
          repository,
          {
            personId: priya.id,
            channel: "email",
            subject: "Your summer internship",
            body,
          },
          at,
        );
        const d = created.ok ? created.changes.drafts![0]! : null;
        await approveDraftStep(repository, { id: d!.id, expected: d!.updatedAt }, at);
      }
      mailbox.deliver(sentToPriya());
      expect(await sync()).toEqual({ status: "synced", recorded: 1 });
      expect((await repository.drafts.list()).map((d) => d.status)).toEqual([
        "approved",
        "approved",
      ]);
    });

    it("marked sent by hand, then seen in Gmail: one message, linked, not two", async () => {
      const at = new Date("2026-10-06T11:20:00Z");
      const created = await createDraftStep(
        repository,
        {
          personId: priya.id,
          channel: "email",
          subject: "Your summer internship",
          body: "Hi Priya",
        },
        at,
      );
      const d = created.ok ? created.changes.drafts![0]! : null;
      const approved = await approveDraftStep(
        repository,
        { id: d!.id, expected: d!.updatedAt },
        at,
      );
      const a = approved.ok ? approved.changes.drafts![0]! : null;
      const marked = await markDraftSentStep(repository, { id: a!.id, expected: a!.updatedAt }, at);
      expect(marked.ok).toBe(true);

      mailbox.deliver(sentToPriya());
      expect(await sync()).toEqual({ status: "synced", recorded: 1 });
      const messages = await repository.interactions.list();
      expect(messages).toHaveLength(1);
      expect(await repository.gmail.linkedInteractions()).toEqual(new Set([messages[0]!.id]));
    });

    it("a revoked grant stops syncing, changes nothing, and asks to reconnect", async () => {
      mailbox.deliver(sentToPriya());
      mailbox.state.revoked = true;
      expect(await sync()).toEqual({ status: "needs_reconnect" });
      expect(await repository.interactions.list()).toEqual([]);
      expect(await repository.gmail.connection()).toMatchObject({
        status: "needs_reconnect",
        lastError: "revoked",
      });
      // No more tries until the user reconnects.
      expect(await sync()).toEqual({ status: "skipped" });
    });

    it("an outage changes nothing and the next sync tries again from the same place", async () => {
      mailbox.deliver(sentToPriya());
      mailbox.state.down = true;
      expect(await sync()).toEqual({ status: "unavailable", recorded: 0 });
      expect(await repository.interactions.list()).toEqual([]);
      expect((await repository.people.get(priya.id))?.relationshipStatus).toBe("new");
      expect(await repository.gmail.connection()).toMatchObject({
        status: "connected",
        lastError: "unavailable",
      });
      mailbox.state.down = false;
      expect(await sync()).toEqual({ status: "synced", recorded: 1 });
    });

    it("disconnecting stops syncing and keeps the history", async () => {
      mailbox.deliver(sentToPriya());
      await sync();
      expect(await repository.gmail.disconnect()).toEqual(SEALED);
      mailbox.deliver(sentToPriya({ id: "m8", subject: "Following up" }));
      expect(await sync()).toEqual({ status: "skipped" });
      expect(await repository.interactions.list()).toHaveLength(1);
      expect(await repository.gmail.connection()).toBeNull();
    });

    it("too long away for Gmail to replay: continues from now", async () => {
      mailbox.deliver(sentToPriya());
      mailbox.state.expired = true;
      expect(await sync()).toEqual({ status: "history_reset", recorded: 0 });
      expect(await repository.gmail.connection()).toMatchObject({ lastError: "history_reset" });
    });

    it("one sync at a time", async () => {
      expect(await repository.gmail.beginSync(0)).not.toBeNull();
      expect(await sync()).toEqual({ status: "skipped" });
    });

    it("an unreadable credential is treated as needing reconnection", async () => {
      await repository.gmail.connect({
        emailAddress: OWNER,
        scopes: [],
        credential: { sealed: "v1.other", keyId: "fedcba9876543210" },
        historyCursor: mailbox.position,
        at: "2026-10-06T11:00:00.000Z" as never,
      });
      expect(await sync()).toEqual({ status: "needs_reconnect" });
    });
  });
}
