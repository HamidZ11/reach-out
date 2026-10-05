import { ago } from "@/components/dates";
import type { Person } from "@/domain/person";
import type { Tone } from "@/features/today/wording";
import { lastExchange, statusFor } from "@/features/today/wording";
import { capitalise, firstName, sentVerb } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import type { Track, Tracks } from "./tracks";

/** "2 to write · 1 to approve · 1 to send" */
export function summary(tracks: Tracks): string {
  const parts = [
    tracks.write.length && `${tracks.write.length} to write`,
    tracks.approve.length && `${tracks.approve.length} to approve`,
    tracks.send.length && `${tracks.send.length} to send`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing is waiting on you";
}

/** The last exchange in a few words: "Emailed 3 days ago", "Met yesterday". */
export function lastLine(person: Person, day: WorkspaceState): string | undefined {
  const last = lastExchange(person, day);
  if (!last) return undefined;
  const when = ago(day.index.daysSince(last.occurredAt));
  if (last.kind === "meeting") return `Met ${when}`;
  if (last.kind === "message_received") return `${firstName(person.name)} replied ${when}`;
  return `${capitalise(sentVerb(last))} ${when}`;
}

/** One line saying what this person needs from you, in words, with its colour. */
export function rowStatus(track: Track, day: WorkspaceState): { text: string; tone: Tone } {
  if (track.ctx) return statusFor(track.ctx);
  const { person } = track;
  if (day.outreachOf(person.id) === "closed") return { text: "Closed", tone: undefined };
  return { text: lastLine(person, day) ?? "Not contacted yet", tone: undefined };
}
