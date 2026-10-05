import type { Person } from "@/domain/person";
import { compareInstants } from "@/domain/time";
import type { TodayItem } from "@/domain/today";
import { lastExchange } from "@/features/today/wording";
import type { ItemContext } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";

/**
 * Outreach: one track per person (D-014), grouped by where it stands. The
 * grouping reads the domain's derived outreach state and Today's items; it
 * stores nothing and never ranks people by a score.
 */

export type TrackKey =
  "write" | "approve" | "send" | "conversation" | "waiting" | "quiet" | "closed";

/** A person's track, and what Today asks of it (if anything). */
export type Track = { person: Person; ctx?: ItemContext; rank: number };

export type Tracks = Record<TrackKey, Track[]>;

/**
 * - To write: a reply to answer, a follow-up that is due, or a first message you planned.
 * - Waiting for your approval / Approved, ready to send: the person's pending draft.
 * - In conversation: you've spoken recently and nothing needs writing.
 * - Sent, waiting to hear: your message is the latest, newest first.
 * - Not contacted yet and Closed sit apart.
 */
export function tracksOf(day: WorkspaceState): Tracks {
  const groups: Tracks = {
    write: [],
    approve: [],
    send: [],
    conversation: [],
    waiting: [],
    quiet: [],
    closed: [],
  };
  for (const person of day.records.people) {
    const mine = day.contexts.filter((c) => c.person?.id === person.id);
    const pick = (...kinds: TodayItem["kind"][]) => mine.find((c) => kinds.includes(c.item.kind));
    const track = (ctx?: ItemContext): Track => ({
      person,
      ctx,
      rank: ctx ? day.contexts.indexOf(ctx) : Number.MAX_SAFE_INTEGER,
    });
    switch (day.outreachOf(person.id)) {
      case "replied":
        if (lastExchange(person, day)?.kind === "message_received") {
          groups.write.push(track(pick("reply_awaiting_response") ?? mine[0]));
        } else {
          groups.conversation.push(track(mine[0]));
        }
        break;
      case "follow_up_due":
        groups.write.push(track(pick("overdue_follow_up", "upcoming_action")));
        break;
      case "draft": {
        const awaiting = day.index
          .pendingDraftsFor(person.id)
          .some((d) => d.status === "awaiting_approval");
        if (awaiting) groups.approve.push(track(pick("draft_awaiting_approval")));
        else groups.send.push(track(pick("draft_ready_to_send")));
        break;
      }
      case "sent":
        groups.waiting.push(track());
        break;
      case "not_started": {
        const planned = day.index.openActionsFor(person.id).some((a) => a.kind === "reach_out");
        if (planned) groups.write.push(track(pick("upcoming_action")));
        else groups.quiet.push(track());
        break;
      }
      case "closed":
        groups.closed.push(track());
        break;
    }
  }
  // To write follows Today's order; waiting shows the most recent message first.
  groups.write.sort((a, b) => a.rank - b.rank);
  const lastAt = (t: Track) => lastExchange(t.person, day)?.occurredAt;
  groups.waiting.sort((a, b) => {
    const [x, y] = [lastAt(a), lastAt(b)];
    return x && y ? compareInstants(y, x) : x ? -1 : y ? 1 : 0;
  });
  return groups;
}

/** The track a person is on, wherever it is grouped. */
export function trackOf(
  person: Person,
  tracks: Tracks,
): { key: TrackKey; track: Track } | undefined {
  for (const [key, list] of Object.entries(tracks) as [TrackKey, Track[]][]) {
    const track = list.find((t) => t.person.id === person.id);
    if (track) return { key, track };
  }
  return undefined;
}
