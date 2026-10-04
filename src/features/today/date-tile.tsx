import type { ReactNode } from "react";
import { dayOf, shortDay } from "@/components/dates";
import * as Icon from "@/components/icons";
import type { CalendarDate } from "@/domain/time";
import type { ItemContext } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import s from "./today.module.css";
import type { Tone } from "./wording";

/**
 * The date tile (DESIGN.md › Date tile): weekday over day, coloured by what it
 * means. Used only where time matters. Decorative: the date is always in the
 * text beside it.
 */
export function DateTile({
  date,
  icon,
  label,
  tone,
  small = false,
}: {
  date?: CalendarDate;
  icon?: ReactNode;
  label?: string;
  tone: Tone;
  small?: boolean;
}) {
  return (
    <span
      className={small ? `${s.tile} ${s.tileSmall}` : s.tile}
      data-tone={tone}
      aria-hidden="true"
    >
      {date ? (
        <>
          <span className={s.tileLabel}>{shortDay(date).split(" ")[0]}</span>
          <span className={s.tileDay}>{Number(date.slice(8, 10))}</span>
        </>
      ) : (
        <>
          {icon}
          {label && <span className={s.tileLabel}>{label}</span>}
        </>
      )}
    </span>
  );
}

export function tileFor(ctx: ItemContext, day: WorkspaceState, small = false) {
  const { item } = ctx;
  const size = small ? 15 : 20;
  switch (item.kind) {
    case "overdue_follow_up":
      return <DateTile small={small} date={item.dueOn} tone="late" />;
    case "reply_awaiting_response":
      return <DateTile small={small} date={dayOf(item.receivedAt, day.user.timeZone)} tone="now" />;
    case "deadline_approaching":
      return (
        <DateTile
          small={small}
          date={item.deadline}
          tone={item.daysRemaining <= 1 ? "late" : "now"}
        />
      );
    case "draft_awaiting_approval":
      return (
        <DateTile
          small={small}
          icon={<Icon.Pen size={size} />}
          label={small ? undefined : "Draft"}
          tone="now"
        />
      );
    case "draft_ready_to_send":
      return (
        <DateTile
          small={small}
          icon={<Icon.Send size={size} />}
          label={small ? undefined : "Send"}
          tone="good"
        />
      );
    case "upcoming_action": {
      const d = item.daysUntilDue;
      return (
        <DateTile
          small={small}
          date={item.dueOn}
          tone={d < 0 ? "late" : d === 0 ? "now" : undefined}
        />
      );
    }
  }
}
