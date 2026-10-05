import type { ReactNode } from "react";
import * as Icon from "@/components/icons";
import type { Person } from "@/domain/person";
import t from "@/features/today/today.module.css";
import type { Tone } from "@/features/today/wording";
import type { ItemContext } from "@/features/workspace/records";
import { firstName } from "@/features/workspace/records";
import k from "./outreach.module.css";
import type { TrackKey } from "./tracks";

/**
 * The action states, in the order you meet them. Each has a mark drawn like
 * the history's nodes: needs you (marigold), in conversation or ready
 * (green), out with them (neutral). Icon and words always come with the colour.
 */
export const STATES: { key: TrackKey; title: string; hint: string; tone: Tone; icon: ReactNode }[] =
  [
    {
      key: "write",
      title: "To write",
      hint: "Replies to answer, follow-ups that are due, and first messages you planned.",
      tone: "now",
      icon: <Icon.Pen size={14} weight={2} />,
    },
    {
      key: "approve",
      title: "Waiting for your approval",
      hint: "Nothing is sent until you approve it.",
      tone: "now",
      icon: <Icon.Check size={14} weight={2.2} />,
    },
    {
      key: "send",
      title: "Approved, ready to send",
      hint: "Send it from your own email or LinkedIn, then mark it as sent.",
      tone: "good",
      icon: <Icon.Send size={14} weight={2} />,
    },
    {
      key: "conversation",
      title: "In conversation",
      hint: "You've spoken recently and nothing needs writing yet.",
      tone: "good",
      icon: <Icon.Chat size={14} weight={2} />,
    },
    {
      key: "waiting",
      title: "Sent, waiting to hear",
      hint: "When a follow-up falls due, it moves up to To write.",
      tone: undefined,
      icon: <Icon.Clock size={14} weight={2} />,
    },
  ];

export function StateMark({ tone, icon }: { tone: Tone; icon: ReactNode }) {
  return (
    <span className={k.stateMark} data-tone={tone} aria-hidden="true">
      {icon}
    </span>
  );
}

/** What the item is responding to, shown before you act on it. */
export function Context({ ctx, person }: { ctx: ItemContext; person: Person }) {
  const { item, message, action } = ctx;
  const first = firstName(person.name);
  const quote = (label: string, icon: ReactNode, text: string, subject?: string) => (
    <div className={k.quote}>
      <p className={t.label}>
        {icon}
        {label}
      </p>
      {subject && <p className={k.quoteSubject}>“{subject}”</p>}
      <p className={t.cellText}>{text}</p>
    </div>
  );
  const subject =
    message && (message.kind === "message_sent" || message.kind === "message_received")
      ? message.subject
      : undefined;
  if (item.kind === "reply_awaiting_response" && message) {
    return quote(`${first}'s reply`, <Icon.Chat size={14} weight={2} />, message.summary, subject);
  }
  if (message && (item.kind === "overdue_follow_up" || action?.kind === "follow_up")) {
    return quote(
      "What you sent",
      <Icon.ArrowUpRight size={14} weight={2} />,
      message.summary,
      subject,
    );
  }
  if (item.kind === "upcoming_action" && (person.whyRelevant || person.notes)) {
    return (
      <div className={k.quote}>
        <p className={t.whyLabel}>
          <Icon.Compass size={14} weight={2} />
          {person.whyRelevant ? `Why ${first} matters` : "Your note"}
        </p>
        <p className={k.quoteWhy}>{person.whyRelevant ?? person.notes}</p>
      </div>
    );
  }
  return null;
}
