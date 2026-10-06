import "server-only";
import type { ObservedEmail } from "@/domain/correspondence";
import { addressesIn } from "@/domain/correspondence";
import { instant } from "@/domain/time";
import type { GmailMessage } from "./api";

/** Mail Reachout never reads into the history: unsent drafts, spam, trash and chat. */
const IGNORED_LABELS = new Set(["DRAFT", "SPAM", "TRASH", "CHAT"]);

export function isIgnored(labelIds: readonly string[] | undefined): boolean {
  return (labelIds ?? []).some((label) => IGNORED_LABELS.has(label));
}

/**
 * A Gmail message as the domain sees it: who, when, the subject, and whether
 * the mailbox owner sent it. Null for mail that never belongs in a history.
 */
export function observedEmail(message: GmailMessage): ObservedEmail | null {
  if (isIgnored(message.labelIds)) return null;
  const sentAtMs = Number(message.internalDate);
  if (!Number.isFinite(sentAtMs) || sentAtMs <= 0) return null;
  const header = (name: string) =>
    message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
  const subject = header("Subject")?.trim();
  return {
    providerMessageId: message.id,
    threadId: message.threadId,
    outgoing: (message.labelIds ?? []).includes("SENT"),
    from: addressesIn(header("From")),
    to: addressesIn(header("To")),
    cc: addressesIn(header("Cc")),
    bcc: addressesIn(header("Bcc")),
    subject: subject ? subject.slice(0, 500) : undefined,
    sentAt: instant(new Date(sentAtMs).toISOString()),
  };
}
