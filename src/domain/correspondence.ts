import type { Draft } from "./draft";
import type { DraftId, InteractionId, PersonId } from "./ids";
import type { Interaction } from "./interaction";
import type { Person } from "./person";
import type { Instant } from "./time";

/**
 * Correspondence seen in the user's own mailbox (Gmail today), and how it
 * joins the relationship history. Provider-independent: the Gmail adapter
 * turns a provider message into an ObservedEmail; these rules decide what, if
 * anything, it means for Reachout.
 *
 * Matching is deliberately conservative: an exact email address on a person
 * the user added, never a display name, company, subject or guess. A person
 * without an email address is never matched.
 */

export type ObservedEmail = {
  /** The provider's id for the message, unique within the mailbox. */
  providerMessageId: string;
  threadId?: string;
  /** The mailbox owner sent it (rather than received it). */
  outgoing: boolean;
  from: string[];
  to: string[];
  cc: string[];
  bcc: string[];
  subject?: string;
  sentAt: Instant;
};

export type CorrespondenceMatch = { personId: PersonId; direction: "sent" | "received" };

/** Windows for recognising the same message recorded by hand (D-031). */
export const CORRESPONDENCE_RULES = {
  /** A message marked sent by hand within this long of the provider's message can be the same one. */
  manualRecordWindowMs: 3 * 24 * 60 * 60 * 1000,
  /** Clock skew allowed between approving a draft and the provider seeing it sent. */
  approvalSkewMs: 5 * 60 * 1000,
} as const;

/** Lower-cased, trimmed address, or nothing if it isn't one. */
export function normaliseAddress(value: string): string | undefined {
  const address = value.trim().toLowerCase();
  const at = address.indexOf("@");
  if (at < 1 || at !== address.lastIndexOf("@") || at === address.length - 1) return undefined;
  if (/[\s<>(),;:"]/.test(address)) return undefined;
  return address;
}

/**
 * The addresses in an address-list header such as
 * `"Priya N" <priya@halden.example>, ops@halden.example`. Display names are
 * dropped: they never identify anyone.
 */
export function addressesIn(header: string | undefined): string[] {
  if (!header) return [];
  const found = new Set<string>();
  // Quoted display names may contain commas and @; take them out first.
  const unquoted = header.replace(/"(?:[^"\\]|\\.)*"/g, " ");
  for (const part of unquoted.split(",")) {
    const bracketed = part.match(/<([^<>]+)>/);
    const address = normaliseAddress(bracketed ? (bracketed[1] ?? "") : part);
    if (address) found.add(address);
  }
  return [...found];
}

/** Subjects compare by their words, ignoring case and spacing. */
export function normaliseSubject(subject: string | undefined): string {
  return (subject ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}

/**
 * Who an email is with: for a message the user sent, every tracked person it
 * went to; for one they received, the tracked person who sent it. An address
 * held by two people names nobody.
 */
export function matchCorrespondence(
  email: ObservedEmail,
  people: readonly Person[],
): CorrespondenceMatch[] {
  const byAddress = new Map<string, PersonId[]>();
  for (const person of people) {
    const address = person.email ? normaliseAddress(person.email) : undefined;
    if (!address) continue;
    byAddress.set(address, [...(byAddress.get(address) ?? []), person.id]);
  }
  const only = (address: string) => {
    const ids = byAddress.get(address);
    return ids?.length === 1 ? ids[0] : undefined;
  };

  if (email.outgoing) {
    const recipients = new Set([...email.to, ...email.cc, ...email.bcc]);
    const matched = new Set<PersonId>();
    for (const address of recipients) {
      const personId = only(address);
      if (personId) matched.add(personId);
    }
    return [...matched].map((personId) => ({ personId, direction: "sent" as const }));
  }

  const [sender] = email.from;
  const personId = sender === undefined ? undefined : only(sender);
  return personId ? [{ personId, direction: "received" }] : [];
}

export type SentReconciliation =
  /** The user already recorded this message by hand: link it, don't add another. */
  | { kind: "link"; interactionId: InteractionId }
  /** It is how the user sent this approved draft: mark the draft sent with it. */
  | { kind: "draft"; draftId: DraftId }
  /** A message Reachout didn't know about: add it to the history. */
  | { kind: "new" };

/**
 * A message the user sent to a tracked person, against what Reachout already
 * holds for them (D-031):
 *
 * 1. A message marked sent by hand (an email, not yet linked to the mailbox)
 *    with the same subject, within the window: that record is this message.
 *    The closest in time wins; ties go to the earlier id.
 * 2. Otherwise exactly one approved email draft for the person with the same
 *    subject, approved before it went out: this message sent that draft.
 *    Two such drafts, or none, and no draft changes.
 * 3. Otherwise it is new.
 */
export function reconcileSent(
  email: ObservedEmail,
  personId: PersonId,
  held: {
    interactions: readonly Interaction[];
    drafts: readonly Draft[];
    /** Interactions already linked to a mailbox message. */
    linked: ReadonlySet<string>;
  },
): SentReconciliation {
  const subject = normaliseSubject(email.subject);
  const sentAt = Date.parse(email.sentAt);

  if (subject) {
    const manual = held.interactions
      .filter(
        (i) =>
          i.kind === "message_sent" &&
          i.personId === personId &&
          i.channel === "email" &&
          !held.linked.has(i.id) &&
          normaliseSubject(i.subject) === subject &&
          Math.abs(Date.parse(i.occurredAt) - sentAt) <= CORRESPONDENCE_RULES.manualRecordWindowMs,
      )
      .toSorted(
        (a, b) =>
          Math.abs(Date.parse(a.occurredAt) - sentAt) -
            Math.abs(Date.parse(b.occurredAt) - sentAt) || a.id.localeCompare(b.id),
      );
    const [closest] = manual;
    if (closest) return { kind: "link", interactionId: closest.id };

    const drafts = held.drafts.filter(
      (d) =>
        d.status === "approved" &&
        d.personId === personId &&
        d.channel === "email" &&
        normaliseSubject(d.subject) === subject &&
        Date.parse(d.approvedAt) <= sentAt + CORRESPONDENCE_RULES.approvalSkewMs,
    );
    const [draft] = drafts;
    if (draft && drafts.length === 1) return { kind: "draft", draftId: draft.id };
  }
  return { kind: "new" };
}

/** What the history says about an email with no subject. */
export const NO_SUBJECT = "(no subject)";

/** The one-line account of an observed email in the history. */
export function summaryOf(email: ObservedEmail): string {
  return email.subject?.trim() || NO_SUBJECT;
}
