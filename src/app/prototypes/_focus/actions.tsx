"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { shortDay } from "../_shared/dates";
import * as Icon from "../_shared/icons";
import type { ItemContext } from "../_shared/snapshot";
import { firstName } from "../_shared/snapshot";
import type { Day } from "../_shared/use-day";
import s from "./focus.module.css";
import type { DraftText } from "./parts";
import { channelFor, Composer, initialDraft } from "./parts";

export type Announce = (message: string) => void;

export type ActionSpec = {
  id: string;
  label: string;
  icon?: ReactNode;
  run?: () => void;
  href?: string;
};

/**
 * One vocabulary of verbs for an attention item, shared by Today, People and
 * mobile. Every action runs the real domain rule and announces its outcome.
 */
export function useItemActions(ctx: ItemContext, day: Day, announce: Announce) {
  const { item, person, action, draft, opportunity } = ctx;
  const first = person ? firstName(person.name) : "";
  const [mode, setMode] = useState<null | "write" | "edit">(null);
  const [text, setText] = useState<DraftText>(() => initialDraft(ctx));
  const channel = person ? channelFor(person, ctx) : "email";
  const snoozeTo = action?.status === "open" ? shortDay(day.snoozeTarget(action)) : undefined;

  const write: ActionSpec = {
    id: "write",
    label:
      item.kind === "reply_awaiting_response"
        ? "Write your reply"
        : item.kind === "overdue_follow_up" || action?.kind === "follow_up"
          ? "Write the follow-up"
          : "Write the message",
    icon: <Icon.Pen size={16} weight={2} />,
    run: () => setMode("write"),
  };
  const snooze: ActionSpec | undefined =
    action?.status === "open" && snoozeTo
      ? {
          id: "snooze",
          label: `Snooze to ${snoozeTo}`,
          icon: <Icon.Moon size={15} weight={2} />,
          run: () => {
            day.snooze(action.id);
            announce(`Snoozed to ${snoozeTo}.`);
          },
        }
      : undefined;
  const complete = (label: string): ActionSpec | undefined =>
    action?.status === "open"
      ? {
          id: "done",
          label,
          icon: <Icon.Check size={16} weight={2} />,
          run: () => {
            day.complete(action.id);
            announce(`Done: ${action.title}.`);
          },
        }
      : undefined;
  const edit: ActionSpec | undefined = draft
    ? {
        id: "edit",
        label: "Edit",
        icon: <Icon.Pen size={15} weight={2} />,
        run: () => {
          setText({ subject: draft.subject ?? "", body: draft.body });
          setMode("edit");
        },
      }
    : undefined;

  let primary: ActionSpec | undefined;
  let secondary: ActionSpec[] = [];
  switch (item.kind) {
    case "overdue_follow_up":
      primary = write;
      secondary = [snooze, complete("Already done")].filter((a): a is ActionSpec => !!a);
      break;
    case "reply_awaiting_response":
      primary = write;
      break;
    case "deadline_approaching":
      primary = opportunity?.url
        ? {
            id: "open",
            label: "Open the posting",
            icon: <Icon.ArrowRight size={16} weight={2} />,
            href: opportunity.url,
          }
        : undefined;
      break;
    case "draft_awaiting_approval":
      primary = draft
        ? {
            id: "approve",
            label: "Approve",
            icon: <Icon.Check size={16} weight={2} />,
            run: () => {
              day.approve(draft.id);
              announce("Approved. Send it yourself, then mark it as sent.");
            },
          }
        : undefined;
      secondary = edit ? [edit] : [];
      break;
    case "draft_ready_to_send":
      primary = draft
        ? {
            id: "sent",
            label: "Mark as sent",
            icon: <Icon.Send size={16} weight={2} />,
            run: () => {
              day.markSent(draft.id);
              announce(`Marked as sent to ${person?.name ?? "them"}. It's in your history.`);
            },
          }
        : undefined;
      secondary = [
        ...(draft
          ? [
              {
                id: "copy",
                label: "Copy text",
                icon: <Icon.Copy size={15} weight={2} />,
                run: () => {
                  void navigator.clipboard?.writeText(draft.body).catch(() => undefined);
                  announce("Copied. Paste it into your message.");
                },
              },
            ]
          : []),
        ...(edit ? [edit] : []),
      ];
      break;
    case "upcoming_action": {
      // Writing is the real work of a message step; for others, doing it is the step.
      const writes = person && (action?.kind === "reach_out" || action?.kind === "follow_up");
      const done = complete("Mark done");
      const posting: ActionSpec | undefined =
        action?.kind === "apply" && opportunity?.url
          ? {
              id: "open",
              label: "Open the posting",
              icon: <Icon.ArrowUpRight size={16} weight={2} />,
              href: opportunity.url,
            }
          : undefined;
      primary = writes ? write : done;
      secondary = [writes ? done : undefined, posting, snooze].filter((a): a is ActionSpec => !!a);
      break;
    }
  }

  const save = () => {
    if (!person) return;
    if (mode === "edit" && draft) {
      day.revise(draft.id, text.body);
      announce("Draft updated. It needs your approval again.");
    } else {
      day.saveDraft({
        personId: person.id,
        opportunityId: opportunity?.id,
        channel,
        subject: text.subject,
        body: text.body,
      });
      announce(`Draft to ${first} saved. It's waiting for your approval.`);
      setText({ subject: "", body: "" });
    }
    setMode(null);
  };

  const composer =
    mode && person ? (
      <Composer
        person={person}
        channel={channel}
        value={text}
        onChange={setText}
        onSave={save}
        editing={mode === "edit"}
        saveLabel={mode === "edit" ? "Save changes" : "Save as draft"}
      />
    ) : null;

  return {
    primary,
    secondary,
    mode,
    /** Hides the composer but keeps what was typed. */
    close: () => setMode(null),
    hasText: text.body.trim() !== "",
    composer,
  };
}

export function ActionButton({
  spec,
  variant,
  className = "",
}: {
  spec: ActionSpec;
  variant: "primary" | "secondary" | "text";
  className?: string;
}) {
  const cls = `${s[variant]} ${className}`.trim();
  if (spec.href) {
    return (
      <a className={cls} href={spec.href} target="_blank" rel="noreferrer">
        {spec.label} {spec.icon}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={spec.run}>
      {spec.icon}
      {spec.label}
    </button>
  );
}

/** A polite status line with Undo, so every action ends with an answer. */
export function useAnnouncer(day: Day, initial?: string) {
  const [toast, setToast] = useState<{ text: string; n: number } | null>(
    initial ? { text: initial, n: 1 } : null,
  );
  const [acted, setActed] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const announce: Announce = (text) => {
    setActed(true);
    setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));
  };

  const view = (
    <div className={s.toastRegion} role="status" aria-live="polite">
      {toast && (
        <div key={toast.n} className={s.toast}>
          <span>{toast.text}</span>
          {day.canUndo && toast.text !== "Undone." && (
            <button
              type="button"
              onClick={() => {
                day.undo();
                setToast({ text: "Undone.", n: toast.n + 1 });
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );

  return { announce, view, acted };
}
