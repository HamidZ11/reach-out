import { describe, expect, it } from "vitest";
import { buildDraft, buildInteraction, buildPerson } from "@/test/builders";
import type { ObservedEmail } from "./correspondence";
import {
  addressesIn,
  matchCorrespondence,
  normaliseAddress,
  normaliseSubject,
  reconcileSent,
} from "./correspondence";
import type { PersonId } from "./ids";
import { instant } from "./time";

const priya = buildPerson({
  id: "prs_priya",
  name: "Priya Natarajan",
  email: "Priya@Halden.example",
});
const priyaN = buildPerson({
  id: "prs_priya_n",
  name: "Priya Nair",
  email: "priya.nair@orbis.example",
});
const noEmail = buildPerson({ id: "prs_tom", name: "Tom Achebe" });

const email = (overrides: Partial<ObservedEmail> = {}): ObservedEmail => ({
  providerMessageId: "18c2a1f0b3",
  outgoing: true,
  from: ["kofi@student.example"],
  to: ["priya@halden.example"],
  cc: [],
  bcc: [],
  subject: "Your summer internship",
  sentAt: instant("2026-10-06T10:00:00.000Z"),
  ...overrides,
});

describe("reading addresses", () => {
  it("takes the address, never the display name", () => {
    expect(
      addressesIn(
        '"Nair, Priya (priya@halden.example)" <priya.nair@orbis.example>, ops@Halden.example',
      ),
    ).toEqual(["priya.nair@orbis.example", "ops@halden.example"]);
    expect(addressesIn(undefined)).toEqual([]);
    expect(addressesIn("Priya Natarajan")).toEqual([]);
  });

  it("normalises case and space, and rejects what isn't an address", () => {
    expect(normaliseAddress("  Priya@Halden.example ")).toBe("priya@halden.example");
    for (const bad of ["priya", "@halden.example", "a@b@c", "a b@c.example", "priya@"]) {
      expect(normaliseAddress(bad)).toBeUndefined();
    }
    expect(normaliseSubject("  Your   summer Internship ")).toBe("your summer internship");
  });
});

describe("who an email is with", () => {
  it("a sent message is with every tracked person it went to, by exact address", () => {
    expect(
      matchCorrespondence(email({ cc: ["priya.nair@orbis.example"] }), [priya, priyaN, noEmail]),
    ).toEqual([
      { personId: "prs_priya", direction: "sent" },
      { personId: "prs_priya_n", direction: "sent" },
    ]);
  });

  it("a received message is with the tracked person who sent it", () => {
    expect(
      matchCorrespondence(
        email({ outgoing: false, from: ["priya@halden.example"], to: ["kofi@student.example"] }),
        [priya, priyaN],
      ),
    ).toEqual([{ personId: "prs_priya", direction: "received" }]);
  });

  it("someone else's message, even in copy with a tracked person, is nobody's reply", () => {
    expect(
      matchCorrespondence(
        email({
          outgoing: false,
          from: ["recruiting@halden.example"],
          cc: ["priya@halden.example"],
        }),
        [priya],
      ),
    ).toEqual([]);
  });

  it("never guesses: similar names, no email, or an address two people share", () => {
    const sameName = buildPerson({
      id: "prs_other",
      name: "Priya Natarajan",
      email: "p.natarajan@else.example",
    });
    expect(matchCorrespondence(email(), [sameName, noEmail])).toEqual([]);
    const twin = buildPerson({
      id: "prs_twin",
      name: "P. Natarajan",
      email: "priya@halden.example",
    });
    expect(matchCorrespondence(email(), [priya, twin])).toEqual([]);
  });
});

describe("a sent message against what Reachout already holds", () => {
  const PRIYA = "prs_priya" as PersonId;
  const manual = buildInteraction({
    id: "int_manual",
    personId: PRIYA,
    kind: "message_sent",
    channel: "email",
    subject: "Your summer internship",
    summary: "Your summer internship",
    occurredAt: "2026-10-06T09:55:00Z",
  });
  const approved = buildDraft({
    id: "drf_approved",
    personId: PRIYA,
    channel: "email",
    subject: "Your  summer internship",
    status: "approved",
    approvedAt: "2026-10-06T09:30:00Z",
  });

  it("a message already marked sent by hand is linked, not added again", () => {
    expect(
      reconcileSent(email(), PRIYA, { interactions: [manual], drafts: [], linked: new Set() }),
    ).toEqual({ kind: "link", interactionId: "int_manual" });
    // Already linked to another mailbox message: it isn't this one.
    expect(
      reconcileSent(email(), PRIYA, {
        interactions: [manual],
        drafts: [],
        linked: new Set(["int_manual"]),
      }),
    ).toEqual({ kind: "new" });
  });

  it("the one approved draft with that subject is the one it sent", () => {
    expect(
      reconcileSent(email(), PRIYA, { interactions: [], drafts: [approved], linked: new Set() }),
    ).toEqual({ kind: "draft", draftId: "drf_approved" });
  });

  it("an uncertain match changes no draft", () => {
    const other = buildDraft({ ...approved, id: "drf_second" });
    const held = (drafts: ReturnType<typeof buildDraft>[]) => ({
      interactions: [],
      drafts,
      linked: new Set<string>(),
    });
    expect(reconcileSent(email(), PRIYA, held([approved, other]))).toEqual({ kind: "new" });
    expect(reconcileSent(email({ subject: "Quick question" }), PRIYA, held([approved]))).toEqual({
      kind: "new",
    });
    expect(reconcileSent(email({ subject: undefined }), PRIYA, held([approved]))).toEqual({
      kind: "new",
    });
    const awaiting = buildDraft({ ...approved, id: "drf_waiting", status: "awaiting_approval" });
    expect(reconcileSent(email(), PRIYA, held([awaiting]))).toEqual({ kind: "new" });
    // Sent before it was approved: not this draft.
    expect(
      reconcileSent(
        email({ sentAt: instant("2026-10-06T09:00:00.000Z") }),
        PRIYA,
        held([approved]),
      ),
    ).toEqual({ kind: "new" });
  });

  it("a hand-made record far from the message in time is a different message", () => {
    expect(
      reconcileSent(email({ sentAt: instant("2026-10-12T10:00:00.000Z") }), PRIYA, {
        interactions: [manual],
        drafts: [],
        linked: new Set(),
      }),
    ).toEqual({ kind: "new" });
  });
});
