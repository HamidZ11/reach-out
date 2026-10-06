"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { Person } from "@/domain/person";
import type { ItemContext } from "@/features/workspace/records";
import { channelNoun, firstName } from "@/features/workspace/records";
import type { ActResult, WorkspaceState } from "@/features/workspace/use-workspace";
import s from "./today.module.css";
import type { DraftText } from "./wording";
import { channelFor, initialDraft } from "./wording";

/** Says how an action went. Failures aren't undoable: there's nothing to undo. */
export type Announce = (message: string, options?: { undoable?: boolean }) => void;

/** Announces a saved change once it is saved, or why it wasn't. */
export function announceResult(
  result: ActResult,
  announce: Announce,
  success: string,
  onSaved?: () => void,
) {
  if (result.ok) {
    announce(success);
    onSaved?.();
  } else if (!result.ignored) {
    announce(result.message, { undoable: false });
  }
}

export type ActionSpec = {
  id: string;
  label: string;
  icon?: ReactNode;
  run?: () => void;
  href?: string;
};

/**
 * One vocabulary of verbs for an attention item. Every action runs a real
 * domain rule, is saved, and then announces its outcome. Nothing is sent from
 * Reachout: "Mark as sent" records what you sent yourself.
 */
export function useItemActions(ctx: ItemContext, day: WorkspaceState, announce: Announce) {
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
            void day
              .snooze(action.id)
              .then((r) => announceResult(r, announce, `Snoozed to ${snoozeTo}.`));
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
            void day
              .complete(action.id)
              .then((r) => announceResult(r, announce, `Done: ${action.title}.`));
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
              void day
                .approve(draft.id)
                .then((r) =>
                  announceResult(r, announce, "Approved. Send it yourself, then mark it as sent."),
                );
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
              void day
                .markSent(draft.id)
                .then((r) =>
                  announceResult(
                    r,
                    announce,
                    `Marked as sent to ${person?.name ?? "them"}. It's in your history.`,
                  ),
                );
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

  // The composer closes only once the draft is saved; if saving fails, what
  // you wrote stays open in front of you.
  const save = () => {
    if (!person) return;
    if (mode === "edit" && draft) {
      void day
        .revise(draft.id, text.body)
        .then((r) =>
          announceResult(r, announce, "Draft updated. It needs your approval again.", () =>
            setMode(null),
          ),
        );
    } else {
      void day
        .saveDraft({
          personId: person.id,
          opportunityId: opportunity?.id,
          channel,
          subject: text.subject,
          body: text.body,
        })
        .then((r) =>
          announceResult(
            r,
            announce,
            `Draft to ${first} saved. It's waiting for your approval.`,
            () => {
              setText({ subject: "", body: "" });
              setMode(null);
            },
          ),
        );
    }
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

/** Labels that fit two to a thumb-width row on a phone: "Snooze to Mon 5 Oct" → "Snooze to Mon". */
export function thumbLabel(spec: ActionSpec): ActionSpec {
  if (spec.id === "snooze") return { ...spec, label: spec.label.split(" ").slice(0, 3).join(" ") };
  if (spec.id === "open") return { ...spec, label: "Open posting" };
  return spec;
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
export function useAnnouncer(
  day: Pick<WorkspaceState, "canUndo" | "undo"> | undefined,
  initial?: string,
) {
  const [toast, setToast] = useState<{ text: string; n: number; undoable: boolean } | null>(
    initial ? { text: initial, n: 1, undoable: false } : null,
  );
  const [acted, setActed] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const announce: Announce = (text, { undoable = true } = {}) => {
    setActed(true);
    setToast((t) => ({ text, n: (t?.n ?? 0) + 1, undoable }));
  };

  const view = (
    <div className={s.toastRegion} role="status" aria-live="polite">
      {toast && (
        <div key={toast.n} className={s.toast}>
          <span>{toast.text}</span>
          {day?.canUndo && toast.undoable && (
            <button
              type="button"
              onClick={() => {
                void day.undo().then((r) => {
                  if (r.ok) setToast({ text: "Undone.", n: toast.n + 1, undoable: false });
                  else if (!r.ignored) {
                    setToast({ text: r.message, n: toast.n + 1, undoable: false });
                  }
                });
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

export type Announcer = ReturnType<typeof useAnnouncer>;

/** Controlled, so closing it never throws text away. Nothing is sent from here. */
function Composer({
  person,
  channel,
  value,
  onChange,
  onSave,
  saveLabel = "Save as draft",
  editing = false,
}: {
  person: Person;
  channel: "email" | "linkedin" | "other";
  value: DraftText;
  onChange: (value: DraftText) => void;
  onSave: () => void;
  saveLabel?: string;
  editing?: boolean;
}) {
  const needsSubject = channel === "email" && !editing && value.subject.trim() === "";
  const ready = value.body.trim() !== "" && !needsSubject;
  return (
    <div className={s.composer}>
      <div className={s.composerHead}>
        <span>
          To {person.name} · {channelNoun(channel)}
        </span>
        <span>{editing ? "Editing sends it back for approval" : "Saved as a draft"}</span>
      </div>
      {channel === "email" && !editing && (
        <input
          aria-label="Subject"
          placeholder="Subject"
          value={value.subject}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
        />
      )}
      <textarea
        aria-label={`Message to ${person.name}`}
        placeholder={`Write to ${firstName(person.name)} the way you'd say it in person.`}
        value={value.body}
        onChange={(e) => onChange({ ...value, body: e.target.value })}
      />
      <div className={s.composerFoot}>
        <button
          type="button"
          className={`${s.primary} ${s.small}`}
          disabled={!ready}
          onClick={onSave}
        >
          {saveLabel}
        </button>
        <span>
          {needsSubject && value.body.trim() !== ""
            ? "Add a subject to save an email."
            : "Nothing is sent from here."}
        </span>
      </div>
    </div>
  );
}
