import { ago, dayCount, longDay, shortDay, weekday } from "@/components/dates";
import type { Person } from "@/domain/person";
import type { ItemContext } from "@/features/workspace/records";
import {
  channelNoun,
  channelOf,
  firstName,
  RELATIONSHIP_LABEL,
} from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";

/**
 * Today's wording: what each attention item asks of you, its status in words
 * with the absolute date, and the lines a day row shows. Presentation only —
 * the ranking itself is `deriveToday` in the domain.
 */

/** Status colour roles from DESIGN.md: overdue, needs attention, in conversation. */
export type Tone = "late" | "now" | "good" | undefined;

/** What the item asks of you, in one line. It is the heading itself, never a label above one. */
export function headline(ctx: ItemContext): string {
  const { item, person, opportunity, action, draft } = ctx;
  const first = person ? firstName(person.name) : "them";
  const channel = draft ? channelNoun(draft.channel) : "message";
  switch (item.kind) {
    case "overdue_follow_up":
    case "upcoming_action":
      return action?.title ?? "Next step";
    case "reply_awaiting_response":
      return `${person?.name ?? "Someone"} replied`;
    case "deadline_approaching":
      return `${opportunity?.title ?? "An opportunity"} closes ${
        item.daysRemaining === 0
          ? "today"
          : item.daysRemaining === 1
            ? "tomorrow"
            : `on ${weekday(item.deadline)}`
      }`;
    case "draft_awaiting_approval":
      return `Approve your ${channel} to ${first}`;
    case "draft_ready_to_send":
      return `Send your ${channel} to ${first}`;
  }
}

/** Relative status with the absolute date beside it. */
export function statusFor(ctx: ItemContext): { tone: Tone; text: string; detail?: string } {
  const { item, draft, message } = ctx;
  switch (item.kind) {
    case "overdue_follow_up":
      return {
        tone: "late",
        text: `${dayCount(item.daysOverdue)} overdue`,
        detail: `due ${shortDay(item.dueOn)}`,
      };
    case "reply_awaiting_response":
      return {
        tone: "now",
        text: `Replied ${ago(-ctx.days)}`,
        detail: `${channelOf(message) ?? "Message"} · your turn`,
      };
    case "deadline_approaching":
      return {
        tone: item.daysRemaining <= 1 ? "late" : "now",
        text:
          item.daysRemaining === 0 ? "Closes today" : `Closes in ${dayCount(item.daysRemaining)}`,
        detail: longDay(item.deadline),
      };
    case "draft_awaiting_approval":
      return {
        tone: "now",
        text: "Waiting for your approval",
        detail: `${draft ? channelNoun(draft.channel) : "Message"} · nothing is sent until you approve it`,
      };
    case "draft_ready_to_send":
      return {
        tone: "good",
        text: "Approved, not sent yet",
        detail:
          draft?.channel === "linkedin"
            ? "Send it on LinkedIn, then mark it as sent"
            : "Send it from your email, then mark it as sent",
      };
    case "upcoming_action": {
      const d = item.daysUntilDue;
      return {
        tone: d < 0 ? "late" : d === 0 ? "now" : undefined,
        text:
          d < 0
            ? `${dayCount(d)} overdue`
            : d === 0
              ? "Due today"
              : d === 1
                ? "Due tomorrow"
                : `Due in ${d} days`,
        detail: shortDay(item.dueOn),
      };
    }
  }
}

/** Day-list rows lead with the person, then what they need from you. */
export function rowLines(ctx: ItemContext): { primary: string; secondary: string } {
  const { item, person, company, opportunity, action } = ctx;
  if (item.kind === "deadline_approaching") {
    return {
      primary: opportunity?.title ?? "Opportunity",
      secondary: `${company ? `${company.name} · ` : ""}closes ${shortDay(item.deadline)}`,
    };
  }
  const secondary =
    item.kind === "reply_awaiting_response"
      ? "Replied — your turn"
      : item.kind === "draft_awaiting_approval"
        ? "Draft waiting for your approval"
        : item.kind === "draft_ready_to_send"
          ? "Approved — ready to send"
          : (action?.title ?? "Next step");
  return { primary: person?.name ?? opportunity?.title ?? "Next step", secondary };
}

/** What a person in a list needs from you today, in one or two words. */
export function personState(
  ctx: ItemContext | undefined,
  person: Person,
): { text: string; tone: Tone } {
  if (!ctx) return { text: RELATIONSHIP_LABEL[person.relationshipStatus], tone: undefined };
  switch (ctx.item.kind) {
    case "overdue_follow_up":
      return { text: "Overdue", tone: "late" };
    case "reply_awaiting_response":
      return { text: "Your turn", tone: "now" };
    case "draft_awaiting_approval":
      return { text: "Draft", tone: "now" };
    case "draft_ready_to_send":
      return { text: "To send", tone: "good" };
    case "upcoming_action": {
      const d = ctx.item.daysUntilDue;
      return {
        text:
          d < 0
            ? "Overdue"
            : d === 0
              ? "Today"
              : d === 1
                ? "Tomorrow"
                : (shortDay(ctx.item.dueOn).split(" ")[0] ?? "Soon"),
        tone: d < 0 ? "late" : undefined,
      };
    }
    case "deadline_approaching":
      return { text: "Deadline", tone: "now" };
  }
}

/** The most recent exchange (not a note) with a person. */
export function lastExchange(person: Person, day: WorkspaceState) {
  return day.index
    .historyOf(person.id)
    .filter((i) => i.kind !== "note")
    .at(-1);
}

/* ——— What the composer starts from ——— */

export type DraftText = { subject: string; body: string };

export function initialDraft(ctx: ItemContext | undefined): DraftText {
  const m = ctx?.message;
  const subject =
    m && (m.kind === "message_sent" || m.kind === "message_received") && m.subject
      ? `Re: ${m.subject.replace(/^Re:\s*/, "")}`
      : "";
  return { subject, body: ctx?.draft?.body ?? "" };
}

export function channelFor(person: Person, ctx?: ItemContext): "email" | "linkedin" | "other" {
  if (ctx?.draft) return ctx.draft.channel;
  const m = ctx?.message;
  if (m && (m.kind === "message_sent" || m.kind === "message_received")) return m.channel;
  return person.preferredChannel ?? (person.email ? "email" : "linkedin");
}

/* ——— Identity and grouping ——— */

/** Drafts keep one identity while their status changes, so approving doesn't lose your place. */
export function stableKey(ctx: ItemContext): string {
  const { item } = ctx;
  return item.kind === "draft_awaiting_approval" || item.kind === "draft_ready_to_send"
    ? `draft:${item.draftId}`
    : ctx.key;
}

/** How "Your day" groups Today's tiers. */
export const GROUPS: { tiers: number[]; label: string }[] = [
  { tiers: [1, 2, 3], label: "Needs you" },
  { tiers: [4], label: "Approve and send" },
  { tiers: [5], label: "Coming up" },
];
